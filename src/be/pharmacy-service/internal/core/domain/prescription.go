package domain

import "time"

type PrescriptionItem struct {
	ID             string
	PrescriptionID string
	ItemCode       string
	Quantity       int32
	Price          float64
}

type Prescription struct {
	ID           string
	EncounterNo  string
	Status       string // "CREATED", "DISPENSED"
	IsCompounded bool
	Notes        string
	Items        []PrescriptionItem
	CreatedAt    time.Time
	UpdatedAt    time.Time
}
