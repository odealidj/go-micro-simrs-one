package domain

import "time"

type Invoice struct {
	ID          string
	EncounterNo string
	RelatedID   string
	Amount      float64
	Status      string // "UNPAID", "PAID"
	CreatedAt   time.Time
}
