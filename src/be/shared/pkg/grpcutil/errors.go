package grpcutil

import (
	"database/sql"
	"errors"
	"strings"

	"github.com/lib/pq"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// DBErrorToGRPC converts standard Go SQL / PostgreSQL errors to appropriate gRPC status errors.
func DBErrorToGRPC(err error, entityName string, customDuplicateMsg ...string) error {
	if err == nil {
		return nil
	}

	// 1. Check for sql.ErrNoRows (Record Not Found -> 404)
	if errors.Is(err, sql.ErrNoRows) {
		return status.Errorf(codes.NotFound, "%s tidak ditemukan.", entityName)
	}

	// 2. Check for Postgres pq.Error codes
	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		switch pqErr.Code {
		case "23505": // unique_violation (Duplicate Key -> 409 Conflict)
			if len(customDuplicateMsg) > 0 && customDuplicateMsg[0] != "" {
				return status.Errorf(codes.AlreadyExists, "%s", customDuplicateMsg[0])
			}
			return status.Errorf(codes.AlreadyExists, "Data %s sudah terdaftar di sistem (duplikat).", entityName)
		case "23503": // foreign_key_violation (400 Bad Request / 412 Failed Precondition)
			return status.Errorf(codes.FailedPrecondition, "Referensi relasi data %s tidak valid atau tidak ditemukan.", entityName)
		case "23502": // not_null_violation
			return status.Errorf(codes.InvalidArgument, "Terdapat field wajib pada %s yang belum diisi.", entityName)
		case "23514": // check_violation
			return status.Errorf(codes.InvalidArgument, "Data %s melanggar aturan validasi database.", entityName)
		}
	}

	// 3. Fallback string inspections for duplicate key
	errStr := strings.ToLower(err.Error())
	if strings.Contains(errStr, "duplicate key") || strings.Contains(errStr, "unique constraint") || strings.Contains(errStr, "23505") {
		if len(customDuplicateMsg) > 0 && customDuplicateMsg[0] != "" {
			return status.Errorf(codes.AlreadyExists, "%s", customDuplicateMsg[0])
		}
		return status.Errorf(codes.AlreadyExists, "Data %s sudah terdaftar di sistem (duplikat).", entityName)
	}

	// 4. Default to codes.Internal (500)
	return status.Errorf(codes.Internal, "Terjadi kesalahan internal pada %s: %v", entityName, err)
}
