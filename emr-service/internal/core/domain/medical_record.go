package domain

import "time"

type MedicalRecord struct {
	EncounterNo string
	MRN         string
	ICD10Codes  []string
	Notes       string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
