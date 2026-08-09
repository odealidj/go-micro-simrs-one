package ports

import (
	"context"

	"github.com/aliube/go-micro-simrs-one/auth-service/internal/core/domain"
)

// UserRepository is the Outbound Port
type UserRepository interface {
	FindByUsername(ctx context.Context, username string) (*domain.User, error)
}

// AuthService is the Inbound Port
type AuthService interface {
	Login(ctx context.Context, username, password string) (token string, role string, userID string, err error)
	ValidateToken(ctx context.Context, token string) (isValid bool, role string, userID string, err error)
}
