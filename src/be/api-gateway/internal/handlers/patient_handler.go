package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/aliube/go-micro-simrs-one/api-gateway/internal/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/response"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/validator"
	authpb "github.com/aliube/go-micro-simrs-one/shared/proto/auth/v1"
	patientpb "github.com/aliube/go-micro-simrs-one/shared/proto/patient/v1"
	"github.com/go-chi/chi/v5"
)

// PatientHandler handles /patient/* and /patients/* routes.
type PatientHandler struct {
	svc *ports.ServicePorts
}

func NewPatientHandler(svc *ports.ServicePorts) *PatientHandler {
	return &PatientHandler{svc: svc}
}

// Register mounts routes (caller must apply RequireRole middleware).
func (h *PatientHandler) Register(r chi.Router) {
	os.MkdirAll("uploads/patients", 0755)
	r.Get("/patients", h.SearchPatients)
	r.Get("/uploads/patients/*", http.StripPrefix("/api/v1/uploads/patients/", http.FileServer(http.Dir("uploads/patients"))).ServeHTTP)
	r.Post("/patient/upload-photo", h.UploadPhoto)
	r.Post("/patient/register", h.RegisterPatient)
	r.Get("/patient/{mrn}", h.GetPatient)
}

func (h *PatientHandler) SearchPatients(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page <= 0 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	if pageSize <= 0 {
		pageSize = 50
	}
	res, err := h.svc.Patient.SearchPatients(r.Context(), &patientpb.SearchPatientsRequest{
		Page:     int32(page),
		PageSize: int32(pageSize),
		Search:   r.URL.Query().Get("search"),
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	meta := response.Meta{
		Page:       page,
		PageSize:   pageSize,
		TotalData:  int(res.TotalCount),
		TotalPages: (int(res.TotalCount) + pageSize - 1) / pageSize,
	}
	if meta.TotalPages < 1 {
		meta.TotalPages = 1
	}
	response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Patients, Meta: meta})
}

func (h *PatientHandler) UploadPhoto(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "Failed to parse form: " + err.Error()})
		return
	}
	file, handler, err := r.FormFile("photo")
	if err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "Failed to get photo: " + err.Error()})
		return
	}
	defer file.Close()

	ext := filepath.Ext(handler.Filename)
	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	dstPath := filepath.Join("uploads", "patients", filename)

	dst, err := os.Create(dstPath)
	if err != nil {
		response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "Failed to create file: " + err.Error()})
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "Failed to save file: " + err.Error()})
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{
		Success: true, Message: "Success",
		Data: map[string]string{"photo_url": "/api/v1/uploads/patients/" + filename},
	})
}

func (h *PatientHandler) RegisterPatient(w http.ResponseWriter, r *http.Request) {
	var payload patientpb.RegisterPatientRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	if err := validator.ValidateAll(map[string]func() error{
		"name": validator.NotEmpty(payload.Name),
		"nik":  validator.NotEmpty(payload.Nik),
		"dob":  validator.IsDate(payload.Dob),
	}); err != nil {
		response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}

	// Step 1: Create User in Auth Service
	authRes, err := h.svc.Auth.Signup(r.Context(), &authpb.SignupRequest{
		Username: payload.Nik,
		Password: payload.Dob, // default password = DOB
		Email:    payload.Nik + "@pasien.local",
		FullName: payload.Name,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	payload.UserId = authRes.UserId

	// Step 2: Register patient record
	res, err := h.svc.Patient.RegisterPatient(r.Context(), &payload)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Patient registered", Data: res})
}

func (h *PatientHandler) GetPatient(w http.ResponseWriter, r *http.Request) {
	mrn := chi.URLParam(r, "mrn")
	res, err := h.svc.Patient.GetPatientByMRN(r.Context(), &patientpb.GetPatientByMRNRequest{Mrn: mrn})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}
