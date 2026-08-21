package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/aliube/go-micro-simrs-one/auth-service/internal/adapters/db"
	"github.com/aliube/go-micro-simrs-one/auth-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/auth-service/internal/core/ports"
)

type userRepoSqlc struct {
	dbConn *sql.DB
	q      *db.Queries
}

func NewUserRepository(d *sql.DB) ports.UserRepository {
	return &userRepoSqlc{
		dbConn: d,
		q:      db.New(d),
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
		Role:                nullableString(u.Role),
		Status:              u.Status.String,
		ForceChangePassword: u.ForceChangePassword.Bool,
		LastLoginAt:         nullableTime(u.LastLoginAt),
		CreatedAt:           u.CreatedAt.Time,
	}, nil
}

func (r *userRepoSqlc) CreateWithProfile(ctx context.Context, user *domain.User, profile *domain.StaffProfile) (*domain.User, error) {
	tx, err := r.dbConn.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	qtx := r.q.WithTx(tx)

	var roleStr string
	if user.Role != nil {
		roleStr = *user.Role
	}
	u, err := qtx.CreateUser(ctx, db.CreateUserParams{
		Username:            user.Username,
		PasswordHash:        user.PasswordHash,
		Role:                sql.NullString{String: roleStr, Valid: user.Role != nil},
		Status:              sql.NullString{String: user.Status, Valid: true},
		ForceChangePassword: sql.NullBool{Bool: user.ForceChangePassword, Valid: true},
	})
	if err != nil {
		return nil, err
	}

	if profile != nil {
		_, err = qtx.CreateStaffProfile(ctx, db.CreateStaffProfileParams{
			UserID: uuid.NullUUID{UUID: u.ID, Valid: true},
			Nip:    profile.NIP,
			Email:  sql.NullString{String: profile.Email, Valid: profile.Email != ""},
			Phone:  sql.NullString{String: profile.Phone, Valid: profile.Phone != ""},
		})
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &domain.User{
		ID:                  u.ID.String(),
		Username:            u.Username,
		PasswordHash:        u.PasswordHash,
		Role:                nullableString(u.Role),
		Status:              u.Status.String,
		ForceChangePassword: u.ForceChangePassword.Bool,
		LastLoginAt:         nullableTime(u.LastLoginAt),
		CreatedAt:           u.CreatedAt.Time,
	}, nil
}

func (r *userRepoSqlc) ListUsers(ctx context.Context, page, pageSize int, statusFilter, search string) ([]*domain.UserWithProfile, int, error) {
	offset := (page - 1) * pageSize

	rows, err := r.q.ListUsersWithProfile(ctx, db.ListUsersWithProfileParams{
		StatusFilter: statusFilter,
		Limit:        int32(pageSize),
		Offset:       int32(offset),
		Search:       search,
	})
	if err != nil {
		return nil, 0, err
	}

	var users []*domain.UserWithProfile
	for _, row := range rows {
		u := &domain.UserWithProfile{
			User: domain.User{
				ID:        row.ID.String(),
				Username:  row.Username,
				Role:      nullableString(row.Role),
				Status:    row.Status.String,
				CreatedAt: row.CreatedAt.Time,
			},
		}
		if row.Nip.Valid && row.Nip.String != "" {
			u.StaffProfile = &domain.StaffProfile{
				NIP:   row.Nip.String,
				Email: row.Email.String,
				Phone: row.Phone.String,
			}
		}
		users = append(users, u)
	}

	totalCount, err := r.q.CountUsersWithProfile(ctx, db.CountUsersWithProfileParams{
		StatusFilter: statusFilter,
		Search:       search,
	})
	if err != nil {
		return nil, 0, err
	}

	return users, int(totalCount), nil
}

func (r *userRepoSqlc) UpdateStatusAndRole(ctx context.Context, userID, status string, role *string) error {
	parsedID, err := uuid.Parse(userID)
	if err != nil {
		return errors.New("invalid user ID")
	}

	roleStr := ""
	if role != nil {
		roleStr = *role
	}

	return r.q.UpdateUserStatusAndRole(ctx, db.UpdateUserStatusAndRoleParams{
		ID:     parsedID,
		Status: sql.NullString{String: status, Valid: true},
		Role:   sql.NullString{String: roleStr, Valid: role != nil},
	})
}

func (r *userRepoSqlc) SoftDelete(ctx context.Context, userID, deletedBy string) error {
	parsedID, err := uuid.Parse(userID)
	if err != nil {
		return errors.New("invalid user ID")
	}
	
	parsedDeletedBy, _ := uuid.Parse(deletedBy)

	return r.q.SoftDeleteUser(ctx, db.SoftDeleteUserParams{
		ID:        parsedID,
		DeletedBy: uuid.NullUUID{UUID: parsedDeletedBy, Valid: deletedBy != ""},
	})
}

func (r *userRepoSqlc) HardDelete(ctx context.Context, userID string) error {
	parsedID, err := uuid.Parse(userID)
	if err != nil {
		return errors.New("invalid user ID")
	}
	
	// Assuming sqlc has a hard delete method, or we can use raw DB. 
	// We'll use raw DB to avoid modifying sqlc queries for now.
	_, err = r.dbConn.ExecContext(ctx, "DELETE FROM auth.users WHERE id = $1", parsedID)
	return err
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
		Role:                nullableString(u.Role),
		Status:              u.Status.String,
		ForceChangePassword: u.ForceChangePassword.Bool,
		LastLoginAt:         nullableTime(u.LastLoginAt),
		CreatedAt:           u.CreatedAt.Time,
	}, nil
}

func nullableString(ns sql.NullString) *string {
	if ns.Valid {
		return &ns.String
	}
	return nil
}

func nullableTime(nt sql.NullTime) *time.Time {
	if nt.Valid {
		return &nt.Time
	}
	return nil
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
