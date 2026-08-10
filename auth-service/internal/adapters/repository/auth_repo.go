package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/aliube/go-micro-simrs-one/auth-service/internal/adapters/db"
	"github.com/aliube/go-micro-simrs-one/auth-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/auth-service/internal/core/ports"
)

type userRepoSqlc struct {
	q *db.Queries
}

func NewUserRepository(d *sql.DB) ports.UserRepository {
	return &userRepoSqlc{
		q: db.New(d),
	}
}

func (r *userRepoSqlc) FindByUsername(ctx context.Context, username string) (*domain.User, error) {
	u, err := r.q.GetUserByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	return &domain.User{
		ID:           u.ID.String(),
		Username:     u.Username,
		PasswordHash: u.PasswordHash,
		Role:         u.Role,
		CreatedAt:    u.CreatedAt.Time,
	}, nil
}
