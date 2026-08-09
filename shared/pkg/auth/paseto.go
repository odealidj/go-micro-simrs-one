package auth

import (
	"errors"
	"time"

	"aidanwoods.dev/go-paseto"
)

var (
	ErrInvalidToken = errors.New("invalid or expired token")
)

// TokenManager handles creation and verification of PASETO tokens.
type TokenManager struct {
	symmetricKey paseto.V4SymmetricKey
}

// NewTokenManager creates a new PASETO token manager with a symmetric key.
// The key should ideally be 32 bytes hex encoded.
func NewTokenManager(hexKey string) (*TokenManager, error) {
	key, err := paseto.V4SymmetricKeyFromHex(hexKey)
	if err != nil {
		return nil, err
	}
	return &TokenManager{symmetricKey: key}, nil
}

// GenerateToken creates a new PASETO v4 local token.
func (tm *TokenManager) GenerateToken(userID string, role string, duration time.Duration) (string, error) {
	token := paseto.NewToken()
	
	token.SetIssuedAt(time.Now())
	token.SetNotBefore(time.Now())
	token.SetExpiration(time.Now().Add(duration))
	
	token.SetString("user_id", userID)
	token.SetString("role", role)

	// Encrypt the token using the symmetric key (v4.local)
	return token.V4Encrypt(tm.symmetricKey, nil), nil
}

// VerifyToken parses and validates a PASETO token.
func (tm *TokenManager) VerifyToken(signedToken string) (*paseto.Token, error) {
	parser := paseto.NewParser()
	
	// Add rule to check if token is expired
	parser.AddRule(paseto.NotExpired())
	
	token, err := parser.ParseV4Local(tm.symmetricKey, signedToken, nil)
	if err != nil {
		return nil, ErrInvalidToken
	}

	return token, nil
}
