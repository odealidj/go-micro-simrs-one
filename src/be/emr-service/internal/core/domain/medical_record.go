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

type ClinicalChecklist struct {
	TriageCompleted        bool
	DiagnosisCompleted     bool
	ActionsCompleted       bool
	ActionsCount           int32
	PrescriptionCompleted  bool
	PrescriptionCount      int32
	IsReadyToComplete      bool
	MissingMandatoryFields []string
	BaseConsultationFee    string
}

type MedicalRecord struct {
	ID                 string
	EncounterNo        string
	MRN                string
	ICD10Codes         []string
	KBMCode            string
	KBMName            string
	ICD10MappingStatus string
	Notes              string
	Status             string
	Triage             TriageData
	Actions            []MedicalAction
	Checklist          ClinicalChecklist
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

type KBMItem struct {
	KBMCode     string
	KBMName     string
	Description string
	BodySystem  string
}

type ICD10Suggestion struct {
	ICD10Code string
	IsPrimary bool
}

type PendingVerification struct {
	EncounterNo        string
	MRN                string
	KBMCode            string
	KBMName            string
	ICD10MappingStatus string
	CreatedAt          time.Time
}
