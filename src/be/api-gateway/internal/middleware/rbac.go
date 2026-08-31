package middleware

import (
	"net/http"

	"github.com/aliube/go-micro-simrs-one/shared/pkg/response"
)

// RequireRole checks if the authenticated user has one of the required roles.
// This must be used after AuthMiddleware which sets the UserRoleKey in context.
func RequireRole(allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get role from context
			roleVal := r.Context().Value("role")
			if roleVal == nil {
				response.JSON(w, http.StatusUnauthorized, response.ErrorResponse{
					Success: false,
					Message: "Unauthorized: Role not found in context",
				})
				return
			}

			userRole, ok := roleVal.(string)
			if !ok {
				response.JSON(w, http.StatusUnauthorized, response.ErrorResponse{
					Success: false,
					Message: "Unauthorized: Invalid role type in context",
				})
				return
			}
			
			// Check if the user's role is in the allowedRoles list
			// Exception: super_admin can access everything
			isAllowed := false
			if userRole == "super_admin" {
				isAllowed = true
			} else {
				for _, allowedRole := range allowedRoles {
					if userRole == allowedRole {
						isAllowed = true
						break
					}
				}
			}

			if !isAllowed {
				response.JSON(w, http.StatusForbidden, response.ErrorResponse{
					Success: false,
					Message: "Forbidden: You don't have enough permission to access this resource",
				})
				return
			}

			// User is authorized, proceed to the next handler
			next.ServeHTTP(w, r)
		})
	}
}
