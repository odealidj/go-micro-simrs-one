package domain

import "time"

type Prescription struct {
	ID          string
	EncounterNo string
	ItemCode    string
	Quantity    int32
	Status      string // "RESERVED", "COMMITTED", "ROLLBACKED"
	Amount      float64
	CreatedAt   time.Time
}
