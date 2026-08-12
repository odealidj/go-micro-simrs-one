// Package validator provides input validation utilities for SIMRS services.
package validator

import (
	"fmt"
	"strings"
	"time"
)

// ValidationError holds a map of field -> error message.
type ValidationError struct {
	Fields map[string]string
}

func (e *ValidationError) Error() string {
	msgs := make([]string, 0, len(e.Fields))
	for field, msg := range e.Fields {
		msgs = append(msgs, fmt.Sprintf("%s %s", field, msg))
	}
	return "Validasi gagal: " + strings.Join(msgs, ", ")
}

// RequiredString returns an error if the value is empty.
func RequiredString(field, value string) error {
	if strings.TrimSpace(value) == "" {
		return &ValidationError{Fields: map[string]string{field: "tidak boleh kosong"}}
	}
	return nil
}

// ValidateAll runs all validators and collects all errors.
// Returns nil if all pass, or a single ValidationError with all field errors.
func ValidateAll(checks map[string]func() error) error {
	errs := make(map[string]string)
	for field, check := range checks {
		if err := check(); err != nil {
			errs[field] = err.Error()
		}
	}
	if len(errs) > 0 {
		return &ValidationError{Fields: errs}
	}
	return nil
}

// NotEmpty is a helper to check a string is not empty.
func NotEmpty(value string) func() error {
	return func() error {
		if strings.TrimSpace(value) == "" {
			return fmt.Errorf("tidak boleh kosong")
		}
		return nil
	}
}

// MinLength is a helper to check minimum string length.
func MinLength(value string, min int) func() error {
	return func() error {
		if len(strings.TrimSpace(value)) < min {
			return fmt.Errorf("harus minimal %d karakter", min)
		}
		return nil
	}
}

// IsDate is a helper to check if a string matches the YYYY-MM-DD format.
func IsDate(value string) func() error {
	return func() error {
		if strings.TrimSpace(value) == "" {
			return nil // Use NotEmpty if it's required
		}
		if _, err := time.Parse("2006-01-02", value); err != nil {
			return fmt.Errorf("format tanggal tidak valid, harus berformat YYYY-MM-DD")
		}
		return nil
	}
}

