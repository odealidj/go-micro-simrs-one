package domain

import "time"

type OutboxEvent struct {
	ID        string
	Aggregate string // e.g., "Encounter"
	Type      string // e.g., "EncounterRegistered"
	Payload   string // JSON string
	Status    string // "PENDING", "PUBLISHED", "FAILED"
	CreatedAt time.Time
}
