package services

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/aliube/go-micro-simrs-one/auth-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/auth-service/internal/core/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/auth"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/genai"
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

func (s *authServiceImpl) Signup(ctx context.Context, nip, password, email, phone string) (string, error) {
	if nip == "admin" || nip == "superadmin" || nip == "super_admin" {
		return "", errors.New("Username tidak valid")
	}

	// 1. Check if user exists by NIP
	_, err := s.repo.FindByUsername(ctx, nip)
	if err == nil {
		return "", errors.New("NIP already registered")
	}

	// 2. Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}

	// 3. Create user (Role is nil, Status is PENDING)
	user := &domain.User{
		Username:            nip, // NIP is used as username for staff
		PasswordHash:        string(hashedPassword),
		Role:                nil,
		Status:              "PENDING",
		ForceChangePassword: true, // Force change password when first logging in if approved
	}

	profile := &domain.StaffProfile{
		NIP:   nip,
		Email: email,
		Phone: phone,
	}

	createdUser, err := s.repo.CreateWithProfile(ctx, user, profile)
	if err != nil {
		return "", err
	}

	return createdUser.ID, nil
}

func (s *authServiceImpl) RegisterPatientUser(ctx context.Context, username, password string) (string, error) {
	if username == "admin" || username == "superadmin" || username == "super_admin" {
		return "", errors.New("Username tidak valid")
	}

	_, err := s.repo.FindByUsername(ctx, username)
	if err == nil {
		return "", errors.New("patient username already registered")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}

	rolePatient := "pasien"
	user := &domain.User{
		Username:            username,
		PasswordHash:        string(hashedPassword),
		Role:                &rolePatient,
		Status:              "ACTIVE",
		ForceChangePassword: true,
	}

	createdUser, err := s.repo.CreateWithProfile(ctx, user, nil)
	if err != nil {
		return "", err
	}

	return createdUser.ID, nil
}

func (s *authServiceImpl) BootstrapAdmin(ctx context.Context, nip, password, email, phone string) error {
	_, err := s.repo.FindByUsername(ctx, nip)
	if err == nil {
		return errors.New("NIP already registered")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	roleAdmin := "admin"
	user := &domain.User{
		Username:            nip,
		PasswordHash:        string(hashedPassword),
		Role:                &roleAdmin,
		Status:              "ACTIVE",
		ForceChangePassword: true,
	}

	profile := &domain.StaffProfile{
		NIP:   nip,
		Email: email,
		Phone: phone,
	}

	_, err = s.repo.CreateWithProfile(ctx, user, profile)
	return err
}

func (s *authServiceImpl) BootstrapSuperAdmin(ctx context.Context, username, password, email, phone string) error {
	_, err := s.repo.FindByUsername(ctx, username)
	if err == nil {
		return errors.New("super admin already registered")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	roleSuperAdmin := "super_admin"
	user := &domain.User{
		Username:            username,
		PasswordHash:        string(hashedPassword),
		Role:                &roleSuperAdmin,
		Status:              "ACTIVE",
		ForceChangePassword: true,
	}

	profile := &domain.StaffProfile{
		NIP:   username,
		Email: email,
		Phone: phone,
	}

	_, err = s.repo.CreateWithProfile(ctx, user, profile)
	return err
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

	// 3. Check status
	if user.Status == "PENDING" {
		return nil, "", "", errors.New("account is pending approval by admin")
	}
	if user.Status == "REJECTED" || user.Status == "INACTIVE" {
		return nil, "", "", errors.New("account is inactive or rejected")
	}

	var role string
	if user.Role != nil {
		role = *user.Role
	}

	// 4. Generate Token Pair
	tokenPair, err := s.generateTokenPair(user.ID, role)
	if err != nil {
		return nil, "", "", err
	}

	return tokenPair, role, user.ID, nil
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

	var role string
	if user.Role != nil {
		role = *user.Role
	}

	// Generate new pair
	tokenPair, err := s.generateTokenPair(user.ID, role)
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

func (s *authServiceImpl) ExtractKTPData(ctx context.Context, base64Image string) (*ports.ExtractKTPDataResult, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return nil, errors.New("GEMINI_API_KEY is not set")
	}

	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey: apiKey,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create genai client: %w", err)
	}

	// Clean up base64 string if it contains data URI prefix
	if idx := strings.Index(base64Image, ","); idx != -1 {
		base64Image = base64Image[idx+1:]
	}
	
	// Decode base64 to get byte array (wait, we can just pass base64 directly or decode it)
	// Actually, the new genai SDK expects parts. If passing image, we can use InlineData.
	// We need to decode it to bytes first.
	imageBytes, err := base64.StdEncoding.DecodeString(base64Image)
	if err != nil {
		return nil, fmt.Errorf("invalid base64 image: %w", err)
	}

	prompt := "Ekstrak informasi dari gambar KTP ini. Kembalikan HANYA dalam format JSON dengan key: 'nik', 'nama', 'tanggal_lahir'. Format tanggal_lahir harus YYYY-MM-DD. Jangan tambahkan teks markdown atau penjelasan apapun."

	contents := []*genai.Content{
		{
			Parts: []*genai.Part{
				{
					Text: prompt,
				},
				{
					InlineData: &genai.Blob{
						MIMEType: "image/jpeg",
						Data:     imageBytes,
					},
				},
			},
		},
	}
	config := &genai.GenerateContentConfig{
		ResponseMIMEType: "application/json",
	}

	resp, err := client.Models.GenerateContent(ctx, "gemini-1.5-flash", contents, config)
	if err != nil {
		return nil, fmt.Errorf("failed to call gemini api: %w", err)
	}

	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		return nil, errors.New("gemini returned empty response")
	}

	var jsonResponse string
	if resp.Candidates[0].Content.Parts[0].Text != "" {
		jsonResponse = resp.Candidates[0].Content.Parts[0].Text
	}

	// Remove possible markdown formatting if the model ignored the instruction
	jsonResponse = strings.TrimPrefix(jsonResponse, "```json\n")
	jsonResponse = strings.TrimPrefix(jsonResponse, "```\n")
	jsonResponse = strings.TrimSuffix(jsonResponse, "\n```")

	var result ports.ExtractKTPDataResult
	if err := json.Unmarshal([]byte(jsonResponse), &result); err != nil {
		return nil, fmt.Errorf("failed to parse gemini JSON response: %w. Raw: %s", err, jsonResponse)
	}

	return &result, nil
}

func (s *authServiceImpl) ListUsers(ctx context.Context, page, pageSize int, statusFilter, search string) ([]*domain.UserWithProfile, int, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 10
	}

	return s.repo.ListUsers(ctx, page, pageSize, statusFilter, search)
}

func (s *authServiceImpl) UpdateUserStatus(ctx context.Context, userID, status string, role *string) error {
	// Status validation can be added here
	validStatuses := map[string]bool{"ACTIVE": true, "INACTIVE": true, "PENDING": true, "REJECTED": true}
	if !validStatuses[status] {
		return errors.New("invalid status")
	}
	return s.repo.UpdateStatusAndRole(ctx, userID, status, role)
}

func (s *authServiceImpl) DeleteUser(ctx context.Context, userID, deletedBy string, hardDelete bool) error {
	if hardDelete {
		return s.repo.HardDelete(ctx, userID)
	}
	return s.repo.SoftDelete(ctx, userID, deletedBy)
}
