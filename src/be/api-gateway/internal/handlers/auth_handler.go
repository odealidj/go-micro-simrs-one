package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/aliube/go-micro-simrs-one/api-gateway/internal/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/response"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/validator"
	authpb "github.com/aliube/go-micro-simrs-one/shared/proto/auth/v1"
	"github.com/go-chi/chi/v5"
)

// AuthHandler handles all /auth/* routes.
type AuthHandler struct {
	svc *ports.ServicePorts
}

func NewAuthHandler(svc *ports.ServicePorts) *AuthHandler {
	return &AuthHandler{svc: svc}
}

// RegisterPublic registers unauthenticated auth routes.
func (h *AuthHandler) RegisterPublic(r chi.Router) {
	r.Post("/auth/login", h.Login)
	r.Post("/auth/refresh", h.Refresh)
	r.Post("/auth/ocr-ktp", h.OCRKTP)
	r.Post("/auth/signup/staff", h.SignupStaff)
	r.Get("/master/label-profesi", h.ListLabelProfesi)
}

// Login handles POST /auth/login.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req authpb.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	if err := validator.ValidateAll(map[string]func() error{
		"username": validator.NotEmpty(req.Username),
		"password": validator.MinLength(req.Password, 6),
	}); err != nil {
		response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	res, err := h.svc.Auth.Login(r.Context(), &req)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

// Refresh handles POST /auth/refresh.
func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	if err := validator.ValidateAll(map[string]func() error{
		"refresh_token": validator.NotEmpty(payload.RefreshToken),
	}); err != nil {
		response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	res, err := h.svc.Auth.RefreshToken(r.Context(), &authpb.RefreshTokenRequest{RefreshToken: payload.RefreshToken})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Token refreshed successfully", Data: res})
}

// OCRKTP handles POST /auth/ocr-ktp.
func (h *AuthHandler) OCRKTP(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Base64Image string `json:"base64_image"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	if payload.Base64Image == "" {
		response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: "base64_image is required"})
		return
	}
	res, err := h.svc.Auth.ExtractKTPData(r.Context(), &authpb.ExtractKTPDataRequest{Base64Image: payload.Base64Image})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "KTP data extracted successfully", Data: res})
}

// SignupStaff handles POST /auth/signup/staff.
func (h *AuthHandler) SignupStaff(w http.ResponseWriter, r *http.Request) {
	var payload authpb.SignupRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	if err := validator.ValidateAll(map[string]func() error{
		"username":  validator.NotEmpty(payload.Username),
		"password":  validator.MinLength(payload.Password, 6),
		"email":     validator.NotEmpty(payload.Email),
		"full_name": validator.NotEmpty(payload.FullName),
	}); err != nil {
		response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	res, err := h.svc.Auth.Signup(r.Context(), &payload)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

// ListLabelProfesi handles GET /master/label-profesi (public).
func (h *AuthHandler) ListLabelProfesi(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.Auth.ListLabelProfesi(r.Context(), &authpb.ListLabelProfesiRequest{})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}
