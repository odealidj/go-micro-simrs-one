package ports

import (
	"context"
	"time"

	"github.com/aliube/go-micro-simrs-one/auth-service/internal/core/domain"
)

// UserRepository is the Outbound Port
type UserRepository interface {
	FindByUsername(ctx context.Context, username string) (*domain.User, error)
	FindByID(ctx context.Context, id string) (*domain.User, error)
	Create(ctx context.Context, user *domain.User) (*domain.User, error)
	
	CreateRefreshToken(ctx context.Context, token *domain.RefreshToken) error
	GetRefreshToken(ctx context.Context, tokenHash string) (*domain.RefreshToken, error)
	DeleteRefreshToken(ctx context.Context, tokenHash string) error
}

type TokenPair struct {
	AccessToken           string
	RefreshToken          string
	AccessTokenExpiresAt  time.Time
	RefreshTokenExpiresAt time.Time
}

type ExtractKTPDataResult struct {
	NIK  string `json:"nik"`
	Name string `json:"nama"`
	DOB  string `json:"tanggal_lahir"`
}

// AuthService is the Inbound Port
type AuthService interface {
	Signup(ctx context.Context, username, password, role string) (userID string, err error)
	Login(ctx context.Context, username, password string) (tokenPair *TokenPair, role string, userID string, err error)
	ValidateToken(ctx context.Context, token string) (isValid bool, role string, userID string, err error)
	RefreshToken(ctx context.Context, refreshToken string) (tokenPair *TokenPair, err error)
	ExtractKTPData(ctx context.Context, base64Image string) (*ExtractKTPDataResult, error)
}
