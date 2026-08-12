package ports

import (
	"context"

	"github.com/aliube/go-micro-simrs-one/auth-service/internal/core/domain"
)

// UserRepository is the Outbound Port
type UserRepository interface {
	FindByUsername(ctx context.Context, username string) (*domain.User, error)
	Create(ctx context.Context, user *domain.User) (*domain.User, error)
}

// AuthService is the Inbound Port
type AuthService interface {
	Signup(ctx context.Context, username, password, role string) (userID string, err error)
	Login(ctx context.Context, username, password string) (token string, role string, userID string, err error)
	ValidateToken(ctx context.Context, token string) (isValid bool, role string, userID string, err error)
}
