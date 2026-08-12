package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/aliube/go-micro-simrs-one/auth-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/auth-service/internal/core/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/auth"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type authServiceImpl struct {
	repo         ports.UserRepository
	tokenManager *auth.TokenManager
}

func NewAuthService(repo ports.UserRepository, tm *auth.TokenManager) ports.AuthService {
	return &authServiceImpl{
		repo:         repo,
		tokenManager: tm,
	}
}

func (s *authServiceImpl) Signup(ctx context.Context, username, password, role string) (string, error) {
	// 1. Check if user exists
	_, err := s.repo.FindByUsername(ctx, username)
	if err == nil {
		return "", errors.New("username already exists")
	}

	// 2. Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}

	// 3. Create user
	user := &domain.User{
		Username:     username,
		PasswordHash: string(hashedPassword),
		Role:         role,
	}

	createdUser, err := s.repo.Create(ctx, user)
	if err != nil {
		return "", err
	}

	return createdUser.ID, nil
}

func (s *authServiceImpl) generateTokenPair(userID string, role string) (*ports.TokenPair, error) {
	// Generate short-lived access token (15 mins)
	accessTokenDuration := 15 * time.Minute
	accessToken, err := s.tokenManager.GenerateToken(userID, role, accessTokenDuration)
	if err != nil {
		return nil, err
	}

	// Generate long-lived refresh token string (UUID)
	refreshTokenStr := uuid.New().String()
	refreshTokenDuration := 7 * 24 * time.Hour
	refreshTokenExpiresAt := time.Now().Add(refreshTokenDuration)

	// Hash refresh token for DB storage using SHA-256 (so we can look it up)
	hash := sha256.Sum256([]byte(refreshTokenStr))
	hashedRefreshToken := hex.EncodeToString(hash[:])

	// Store refresh token
	rt := &domain.RefreshToken{
		UserID:    userID,
		TokenHash: hashedRefreshToken,
		ExpiresAt: refreshTokenExpiresAt,
	}

	if err := s.repo.CreateRefreshToken(context.Background(), rt); err != nil {
		return nil, err
	}

	return &ports.TokenPair{
		AccessToken:           accessToken,
		RefreshToken:          refreshTokenStr,
		AccessTokenExpiresAt:  time.Now().Add(accessTokenDuration),
		RefreshTokenExpiresAt: refreshTokenExpiresAt,
	}, nil
}

func (s *authServiceImpl) Login(ctx context.Context, username, password string) (*ports.TokenPair, string, string, error) {
	// 1. Get user from repo
	user, err := s.repo.FindByUsername(ctx, username)
	if err != nil {
		return nil, "", "", errors.New("invalid credentials")
	}

	// 2. Validate password using bcrypt
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil { 
		return nil, "", "", errors.New("invalid credentials")
	}

	// 3. Generate Token Pair
	tokenPair, err := s.generateTokenPair(user.ID, user.Role)
	if err != nil {
		return nil, "", "", err
	}

	return tokenPair, user.Role, user.ID, nil
}

func (s *authServiceImpl) RefreshToken(ctx context.Context, refreshToken string) (*ports.TokenPair, error) {
	// Validate refresh token format
	if refreshToken == "" {
		return nil, errors.New("invalid refresh token")
	}

	// Hash the incoming token with SHA-256
	hash := sha256.Sum256([]byte(refreshToken))
	hashedTokenStr := hex.EncodeToString(hash[:])

	// Lookup the token in the DB
	rt, err := s.repo.GetRefreshToken(ctx, hashedTokenStr)
	if err != nil {
		return nil, errors.New("invalid or expired refresh token")
	}

	// Check expiration
	if time.Now().After(rt.ExpiresAt) {
		_ = s.repo.DeleteRefreshToken(ctx, hashedTokenStr)
		return nil, errors.New("invalid or expired refresh token")
	}

	// Get user role
	user, err := s.repo.FindByID(ctx, rt.UserID)
	if err != nil {
		return nil, errors.New("user not found")
	}

	// Generate new pair
	tokenPair, err := s.generateTokenPair(user.ID, user.Role)
	if err != nil {
		return nil, err
	}

	// Delete old refresh token (rotation)
	_ = s.repo.DeleteRefreshToken(ctx, hashedTokenStr)

	return tokenPair, nil
}

func (s *authServiceImpl) ValidateToken(ctx context.Context, token string) (bool, string, string, error) {
	parsedToken, err := s.tokenManager.VerifyToken(token)
	if err != nil {
		return false, "", "", err
	}

	userID, err := parsedToken.GetString("user_id")
	if err != nil {
		return false, "", "", err
	}
	
	role, err := parsedToken.GetString("role")
	if err != nil {
		return false, "", "", err
	}

	return true, role, userID, nil
}
