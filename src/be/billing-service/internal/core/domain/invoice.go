package domain

import "time"

type InvoiceItem struct {
	ID          string
	InvoiceID   string
	ItemType    string // "ACTION", "MEDICINE"
	Description string
	Amount      float64
	CreatedAt   time.Time
}

type Invoice struct {
	ID          string
	EncounterNo string
	TotalAmount float64
	Status      string // "UNPAID", "PAID"
	Items       []InvoiceItem
	CreatedAt   time.Time
	PaidAt      *time.Time
}
