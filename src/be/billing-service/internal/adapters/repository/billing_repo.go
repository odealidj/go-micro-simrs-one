package repository

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"time"

	"github.com/aliube/go-micro-simrs-one/billing-service/internal/adapters/db"
	"github.com/aliube/go-micro-simrs-one/billing-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/billing-service/internal/core/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/outbox"
)

type billingRepoSqlc struct {
	q  *db.Queries
	db *sql.DB
}

func NewBillingRepository(d *sql.DB) ports.BillingRepository {
	return &billingRepoSqlc{
		q:  db.New(d),
		db: d,
	}
}

func (r *billingRepoSqlc) GetInvoiceByEncounterNo(ctx context.Context, encounterNo string) (*domain.Invoice, error) {
	inv, err := r.q.GetInvoiceByEncounterNo(ctx, encounterNo)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("invoice not found")
		}
		return nil, err
	}
	return r.buildDomainInvoice(ctx, inv)
}

func (r *billingRepoSqlc) GetInvoice(ctx context.Context, id string) (*domain.Invoice, error) {
	inv, err := r.q.GetInvoice(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("invoice not found")
		}
		return nil, err
	}
	return r.buildDomainInvoice(ctx, inv)
}

func (r *billingRepoSqlc) buildDomainInvoice(ctx context.Context, inv db.Invoice) (*domain.Invoice, error) {
	itemsDb, err := r.q.GetInvoiceItems(ctx, inv.ID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	var items []domain.InvoiceItem
	for _, item := range itemsDb {
		amount, _ := strconv.ParseFloat(item.Amount, 64)
		items = append(items, domain.InvoiceItem{
			ID:          item.ID,
			InvoiceID:   item.InvoiceID,
			ItemType:    item.ItemType,
			Description: item.Description,
			Amount:      amount,
			CreatedAt:   item.CreatedAt.Time,
		})
	}

	tot, _ := strconv.ParseFloat(inv.TotalAmount, 64)
	
	var paidAt *time.Time
	if inv.PaidAt.Valid {
		paidAt = &inv.PaidAt.Time
	}

	return &domain.Invoice{
		ID:          inv.ID,
		EncounterNo: inv.EncounterNo,
		TotalAmount: tot,
		Status:      inv.Status,
		Items:       items,
		CreatedAt:   inv.CreatedAt.Time,
		PaidAt:      paidAt,
	}, nil
}

func (r *billingRepoSqlc) CreateInvoice(ctx context.Context, invoice *domain.Invoice) error {
	_, err := r.q.CreateInvoice(ctx, db.CreateInvoiceParams{
		ID:          invoice.ID,
		EncounterNo: invoice.EncounterNo,
		TotalAmount: strconv.FormatFloat(invoice.TotalAmount, 'f', 2, 64),
		Status:      invoice.Status,
	})
	return err
}

func (r *billingRepoSqlc) CreateInvoiceItem(ctx context.Context, item *domain.InvoiceItem) error {
	_, err := r.q.CreateInvoiceItem(ctx, db.CreateInvoiceItemParams{
		ID:          item.ID,
		InvoiceID:   item.InvoiceID,
		ItemType:    item.ItemType,
		Description: item.Description,
		Amount:      strconv.FormatFloat(item.Amount, 'f', 2, 64),
	})
	return err
}

func (r *billingRepoSqlc) UpdateInvoiceAmount(ctx context.Context, id string, amount float64) error {
	_, err := r.q.UpdateInvoiceAmount(ctx, db.UpdateInvoiceAmountParams{
		ID:          id,
		TotalAmount: strconv.FormatFloat(amount, 'f', 2, 64),
	})
	return err
}

func (r *billingRepoSqlc) UpdateInvoiceStatus(ctx context.Context, id, status string) error {
	var paidAt sql.NullTime
	if status == "PAID" {
		paidAt = sql.NullTime{Time: time.Now(), Valid: true}
	}
	_, err := r.q.UpdateInvoiceStatus(ctx, db.UpdateInvoiceStatusParams{
		ID:     id,
		Status: status,
		PaidAt: paidAt,
	})
	return err
}

func (r *billingRepoSqlc) SoftDeleteInvoiceItemByPattern(ctx context.Context, invoiceID, pattern string) error {
	return r.q.SoftDeleteInvoiceItemByPattern(ctx, db.SoftDeleteInvoiceItemByPatternParams{
		InvoiceID:   invoiceID,
		Description: pattern,
	})
}

func (r *billingRepoSqlc) RecalculateInvoiceTotal(ctx context.Context, invoiceID string) error {
	_, err := r.q.RecalculateInvoiceTotal(ctx, invoiceID)
	return err
}

func (r *billingRepoSqlc) CreateOutboxEvent(ctx context.Context, eventID, aggregateType, eventType, payload string) error {
	_, err := r.q.CreateOutboxEvent(ctx, db.CreateOutboxEventParams{
		ID:            eventID,
		AggregateType: aggregateType,
		EventType:     eventType,
		Payload:       []byte(payload),
		Status:        "PENDING",
	})
	return err
}

// Outbox implementation
func (r *billingRepoSqlc) GetPendingOutboxEvents(ctx context.Context) ([]outbox.Event, error) {
	dbEvents, err := r.q.GetPendingOutboxEvents(ctx)
	if err != nil {
		return nil, err
	}

	var events []outbox.Event
	for _, e := range dbEvents {
		events = append(events, outbox.Event{
			ID:            e.ID,
			AggregateType: e.AggregateType,
			EventType:     e.EventType,
			Payload:       e.Payload,
			Status:        e.Status,
			CreatedAt:     e.CreatedAt.Time,
		})
	}
	return events, nil
}

func (r *billingRepoSqlc) MarkEventAsPublished(ctx context.Context, id string) error {
	return r.q.UpdateOutboxEventStatus(ctx, db.UpdateOutboxEventStatusParams{
		ID:     id,
		Status: "PUBLISHED",
	})
}

func (r *billingRepoSqlc) MarkEventAsFailed(ctx context.Context, id string) error {
	return r.q.UpdateOutboxEventStatus(ctx, db.UpdateOutboxEventStatusParams{
		ID:     id,
		Status: "FAILED",
	})
}
