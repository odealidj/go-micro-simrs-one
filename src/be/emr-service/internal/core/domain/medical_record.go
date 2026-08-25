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

type EncounterDiagnosis struct {
	ID                   string
	ICD10Code            string
	ICD10Name            string
	DiagnosisType        string
	Sequence             int32
	ClinicalNotes        string
	SeverityLevel        string
	SeveritySetRole      string
	AutoKBMCode          string
	AutoKBMName          string
	KBMMappingConfidence string
	IsVerifiedByRM       bool
	VerifiedBy           string
}

type MedicalRecord struct {
	ID                     string
	EncounterNo            string
	MRN                    string
	Notes                  string
	Status                 string
	Triage                 TriageData
	Diagnoses              []EncounterDiagnosis
	Actions                []MedicalAction
	Checklist              ClinicalChecklist
	EncounterSeverityLevel string
	CreatedAt              time.Time
	UpdatedAt              time.Time
}

type KBMItem struct {
	KBMCode     string
	KBMName     string
	Description string
	BodySystem  string
}

type KBMSuggestion struct {
	KBMCode            string
	KBMName            string
	IsPrimary          bool
	MappingConfidence  string
}

type PendingVerification struct {
	EncounterNo        string
	MRN                string
	ICD10Code          string
	ICD10Name          string
	KBMCode            string
	KBMName            string
	CreatedAt          time.Time
}
