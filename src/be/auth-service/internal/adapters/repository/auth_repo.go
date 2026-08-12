package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"

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

func (r *userRepoSqlc) Create(ctx context.Context, user *domain.User) (*domain.User, error) {
	u, err := r.q.CreateUser(ctx, db.CreateUserParams{
		Username:     user.Username,
		PasswordHash: user.PasswordHash,
		Role:         user.Role,
	})
	if err != nil {
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

func (r *userRepoSqlc) FindByID(ctx context.Context, id string) (*domain.User, error) {
	parsedID, err := uuid.Parse(id)
	if err != nil {
		return nil, errors.New("invalid user ID")
	}
	u, err := r.q.GetUserByID(ctx, parsedID)
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

func (r *userRepoSqlc) CreateRefreshToken(ctx context.Context, token *domain.RefreshToken) error {
	parsedUserID, err := uuid.Parse(token.UserID)
	if err != nil {
		return errors.New("invalid user ID")
	}

	_, err = r.q.CreateRefreshToken(ctx, db.CreateRefreshTokenParams{
		UserID:    parsedUserID,
		TokenHash: token.TokenHash,
		ExpiresAt: token.ExpiresAt,
	})
	return err
}

func (r *userRepoSqlc) GetRefreshToken(ctx context.Context, tokenHash string) (*domain.RefreshToken, error) {
	rt, err := r.q.GetRefreshToken(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("refresh token not found")
		}
		return nil, err
	}

	return &domain.RefreshToken{
		ID:        rt.ID.String(),
		UserID:    rt.UserID.String(),
		TokenHash: rt.TokenHash,
		ExpiresAt: rt.ExpiresAt,
	}, nil
}

func (r *userRepoSqlc) DeleteRefreshToken(ctx context.Context, tokenHash string) error {
	return r.q.DeleteRefreshToken(ctx, tokenHash)
}
