package domain

import "time"

type User struct {
	ID                  string
	Username            string
	PasswordHash        string
	Role                *string
	Status              string
	ForceChangePassword bool
	LastLoginAt         *time.Time
	CreatedAt           time.Time
}

type StaffProfile struct {
	ID        string
	UserID    string
	NIP       string
	Email     string
	Phone     string
	CreatedAt time.Time
}

type UserWithProfile struct {
	User
	StaffProfile *StaffProfile
}

type RefreshToken struct {
	ID        string
	UserID    string
	TokenHash string
	ExpiresAt time.Time
}
