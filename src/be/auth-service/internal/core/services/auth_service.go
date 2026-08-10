package services

import (
	"context"
	"errors"
	"time"

	"github.com/aliube/go-micro-simrs-one/auth-service/internal/core/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/auth"
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

func (s *authServiceImpl) Login(ctx context.Context, username, password string) (string, string, string, error) {
	// 1. Get user from repo
	user, err := s.repo.FindByUsername(ctx, username)
	if err != nil {
		return "", "", "", errors.New("invalid credentials")
	}

	// 2. Validate password (dummy check for demonstration, should use bcrypt)
	if user.PasswordHash != password { 
		return "", "", "", errors.New("invalid credentials")
	}

	// 3. Generate PASETO
	token, err := s.tokenManager.GenerateToken(user.ID, user.Role, 24 * time.Hour) 
	if err != nil {
		return "", "", "", err
	}

	return token, user.Role, user.ID, nil
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
