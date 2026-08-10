package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/aliube/go-micro-simrs-one/shared/pkg/auth"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/response"
)

// AuthMiddleware creates a chi middleware for PASETO token verification.
func AuthMiddleware(tokenManager *auth.TokenManager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				response.JSON(w, http.StatusUnauthorized, response.ErrorResponse{
					Success: false,
					Message: "Authorization header is required",
				})
				return
			}

			fields := strings.Fields(authHeader)
			if len(fields) < 2 || strings.ToLower(fields[0]) != "bearer" {
				response.JSON(w, http.StatusUnauthorized, response.ErrorResponse{
					Success: false,
					Message: "Invalid authorization header format",
				})
				return
			}

			tokenString := fields[1]
			payload, err := tokenManager.VerifyToken(tokenString)
			if err != nil {
				response.JSON(w, http.StatusUnauthorized, response.ErrorResponse{
					Success: false,
					Message: "Invalid or expired token",
				})
				return
			}

			userID, _ := payload.GetString("user_id")
			role, _ := payload.GetString("role")

			// Store payload in context for downstream handlers
			ctx := context.WithValue(r.Context(), "user_id", userID)
			ctx = context.WithValue(ctx, "role", role)
			
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
