package domain

import "time"

type Patient struct {
	MRN        string // Medical Record Number
	Name       string
	NIK        string
	DOB        string
	Gender     string
	BirthPlace string
	Address    string
	PhotoURL   string
	Email      string
	UserID     string
	CreatedAt  time.Time
}
