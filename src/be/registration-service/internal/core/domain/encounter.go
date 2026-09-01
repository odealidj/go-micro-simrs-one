package domain

import "time"

type Encounter struct {
	EncounterNo    string
	MRN            string
	DepartmentCode string
	DoctorID       string
	PerawatID      string
	Status         string
	CreatedAt      time.Time
	IsNewPatient   bool
}
