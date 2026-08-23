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
	CreateWithProfile(ctx context.Context, user *domain.User, profile *domain.StaffProfile) (*domain.User, error)
	ListUsers(ctx context.Context, page, pageSize int, statusFilter, search string) ([]*domain.UserWithProfile, int, error)
	UpdateStatusAndRole(ctx context.Context, userID, status string, role *string) error
	SoftDelete(ctx context.Context, userID, deletedBy string) error
	HardDelete(ctx context.Context, userID string) error
	
	CreateRefreshToken(ctx context.Context, token *domain.RefreshToken) error
	GetRefreshToken(ctx context.Context, tokenHash string) (*domain.RefreshToken, error)
	DeleteRefreshToken(ctx context.Context, tokenHash string) error
	
	GetActivePoliCode(ctx context.Context, userID string, role string) (string, error)
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
	Signup(ctx context.Context, username, password, email, phone, fullName, nip string, labelProfesiID int32) (userID string, err error)
	RegisterPatientUser(ctx context.Context, username, password string) (userID string, err error)
	BootstrapAdmin(ctx context.Context, nip, password, email, phone string) error
	BootstrapSuperAdmin(ctx context.Context, username, password, email, phone string) error
	Login(ctx context.Context, username, password string) (tokenPair *TokenPair, role string, userID string, poliCode string, err error)
	ValidateToken(ctx context.Context, token string) (isValid bool, role string, userID string, err error)
	RefreshToken(ctx context.Context, refreshToken string) (tokenPair *TokenPair, err error)
	ExtractKTPData(ctx context.Context, base64Image string) (*ExtractKTPDataResult, error)
	
	ListUsers(ctx context.Context, page, pageSize int, statusFilter, search string) ([]*domain.UserWithProfile, int, error)
	UpdateUserStatus(ctx context.Context, userID, status string, role *string) error
	DeleteUser(ctx context.Context, userID, deletedBy string, hardDelete bool) error
}
