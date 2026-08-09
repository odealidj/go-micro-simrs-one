package response

import (
	"encoding/json"
	"net/http"
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

// JSON is a utility to write an HTTP JSON response.
func JSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		// Just log in a real scenario
	}
}
