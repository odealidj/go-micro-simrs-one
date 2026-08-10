package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/aliube/go-micro-simrs-one/billing-service/internal/adapters/db"
	"github.com/aliube/go-micro-simrs-one/billing-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/billing-service/internal/core/ports"
)

type billingRepoSqlc struct {
	q *db.Queries
}

func NewBillingRepository(d *sql.DB) ports.BillingRepository {
	return &billingRepoSqlc{
		q: db.New(d),
	}
}

func (r *billingRepoSqlc) SaveInvoice(ctx context.Context, invoice *domain.Invoice) error {
	_, err := r.q.CreateInvoice(ctx, db.CreateInvoiceParams{
		ID:          invoice.ID,
		EncounterNo: invoice.EncounterNo,
		RelatedID:   invoice.RelatedID,
		Amount:      fmt.Sprintf("%.2f", invoice.Amount),
		Status:      invoice.Status,
	})
	return err
}
