package response

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// Meta represents pagination metadata.
type Meta struct {
	Page       int  `json:"page"`
	PageSize   int  `json:"page-size"`
	TotalData  int  `json:"total_data"`
	TotalPages int  `json:"total_pages"`
	PrevPage   bool `json:"prev_page"`
	NextPage   bool `json:"next_page"`
}

// SuccessResponse is used for a standard successful API return.
type SuccessResponse struct {
	RequestID string      `json:"request_id"`
	TraceID   string      `json:"trace_id"`
	Success   bool        `json:"success"`
	Message   string      `json:"message"`
	Data      interface{} `json:"data"`
}

// SuccessPaginatedResponse is used for returning paginated collections.
type SuccessPaginatedResponse struct {
	RequestID string      `json:"request_id"`
	TraceID   string      `json:"trace_id"`
	Success   bool        `json:"success"`
	Message   string      `json:"message"`
	Data      interface{} `json:"data"`
	Meta      Meta        `json:"meta"`
}

// ErrorResponse is used to return a generic error message, avoiding leakage of stack traces.
type ErrorResponse struct {
	RequestID string `json:"request_id"`
	TraceID   string `json:"trace_id"`
	Success   bool   `json:"success"`
	Message   string `json:"message"`
}

// ErrorMessages maps gRPC status codes to user-friendly Indonesian messages.
var ErrorMessages = map[codes.Code]string{
	codes.InvalidArgument:  "Data yang diberikan tidak valid. Silakan periksa kembali input Anda.",
	codes.Unauthenticated:  "Sesi Anda telah berakhir atau token tidak valid. Silakan login kembali.",
	codes.PermissionDenied: "Anda tidak memiliki akses untuk melakukan tindakan ini.",
	codes.NotFound:         "Data yang Anda cari tidak ditemukan.",
	codes.AlreadyExists:    "Data sudah terdaftar di sistem. Silakan gunakan data lain.",
	codes.Unavailable:      "Layanan sedang tidak tersedia sementara waktu. Silakan coba lagi nanti.",
	codes.Internal:         "Terjadi kesalahan pada server. Tim kami sedang menanganinya.",
}

// JSON is a utility to write an HTTP JSON response.
func JSON(w http.ResponseWriter, status int, payload interface{}) {
	reqID := w.Header().Get("X-Request-Id")
	traceID := w.Header().Get("X-Trace-ID")

	switch p := payload.(type) {
	case SuccessResponse:
		p.RequestID = reqID
		p.TraceID = traceID
		payload = p
	case SuccessPaginatedResponse:
		p.RequestID = reqID
		p.TraceID = traceID
		payload = p
	case ErrorResponse:
		p.RequestID = reqID
		p.TraceID = traceID
		payload = p
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		// Just log in a real scenario
	}
}

// HandleGRPCError maps a gRPC error to an HTTP error response.
func HandleGRPCError(w http.ResponseWriter, err error) {
	st, ok := status.FromError(err)
	if !ok {
		slog.Error("Non-gRPC error encountered", "error", err.Error())
		JSON(w, http.StatusInternalServerError, ErrorResponse{
			Success: false,
			Message: "Terjadi kesalahan yang tidak terduga pada server.",
		})
		return
	}

	// Log the original error for debugging purposes
	slog.Error("gRPC Error", "code", st.Code().String(), "details", st.Message())

	var httpStatus int
	switch st.Code() {
	case codes.InvalidArgument:
		httpStatus = http.StatusBadRequest
	case codes.Unauthenticated:
		httpStatus = http.StatusUnauthorized
	case codes.PermissionDenied:
		httpStatus = http.StatusForbidden
	case codes.NotFound:
		httpStatus = http.StatusNotFound
	case codes.AlreadyExists:
		httpStatus = http.StatusConflict
	case codes.FailedPrecondition:
		httpStatus = http.StatusBadRequest
	case codes.Unimplemented:
		httpStatus = http.StatusNotImplemented
	case codes.Unavailable:
		httpStatus = http.StatusServiceUnavailable
	default:
		httpStatus = http.StatusInternalServerError
	}

	// Use generic message if available, else fallback to internal error
	userMsg, exists := ErrorMessages[st.Code()]
	if !exists {
		userMsg = ErrorMessages[codes.Internal]
	}

	// For FailedPrecondition or AlreadyExists, use the specific business validation message if provided
	if (st.Code() == codes.FailedPrecondition || st.Code() == codes.AlreadyExists) && st.Message() != "" {
		userMsg = st.Message()
	}

	// Override specific gRPC error messages for better UX
	if st.Code() == codes.Unauthenticated {
		if st.Message() == "invalid credentials" {
			userMsg = "Username atau password salah."
		} else if st.Message() == "account is pending approval by admin" {
			userMsg = "Akun Anda belum aktif. Silakan tunggu konfirmasi Admin."
		} else if st.Message() == "account is inactive or rejected" {
			userMsg = "Akun Anda tidak aktif atau ditolak."
		}
	}

	JSON(w, httpStatus, ErrorResponse{
		Success: false,
		Message: userMsg,
	})
}
