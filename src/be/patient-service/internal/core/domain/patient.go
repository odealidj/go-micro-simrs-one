package domain

import "time"

type Patient struct {
	MRN       string // Medical Record Number
	Name      string
	NIK       string
	DOB       string
	UserID    string
	CreatedAt time.Time
}
