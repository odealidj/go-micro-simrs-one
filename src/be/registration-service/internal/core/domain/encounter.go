package domain

import "time"

type Encounter struct {
	EncounterNo  string
	MRN          string
	Department   string
	DoctorID     string
	PerawatID    string
	Status       string
	CreatedAt    time.Time
	IsNewPatient bool
}
