package outbox

import "time"

// Event represents a standardized Outbox Event structure
type Event struct {
	ID            string
	AggregateType string
	EventType     string
	Payload       []byte // Stored as JSONb or string
	Status        string // "PENDING", "PUBLISHED", "FAILED"
	CreatedAt     time.Time
}

// Repository defines the interface the generic Relay worker needs to interact with the local database
type Repository interface {
	GetPendingOutboxEvents(ctx context.Context) ([]Event, error)
	MarkEventAsPublished(ctx context.Context, id string) error
	MarkEventAsFailed(ctx context.Context, id string) error
}
