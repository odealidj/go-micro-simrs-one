package domain

import "time"

type MedicalAction struct {
	ID              string
	MedicalRecordID string
	ActionCode      string
	ActionName      string
	Price           float64
	Notes           string
	CreatedAt       time.Time
}

type TriageData struct {
	BloodPressureSystolic  *int32
	BloodPressureDiastolic *int32
	Temperature            *float64 // using float64 to map to numeric
	HeartRate              *int32
}

type MedicalRecord struct {
	ID          string
	EncounterNo string
	MRN         string
	ICD10Codes  []string
	Notes       string
	Triage      TriageData
	Actions     []MedicalAction
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
