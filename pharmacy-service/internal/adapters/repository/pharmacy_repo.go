package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"

	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/adapters/db"
	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/core/ports"
)

type pharmacyRepoSqlc struct {
	q *db.Queries
}

func NewPharmacyRepository(d *sql.DB) ports.PharmacyRepository {
	return &pharmacyRepoSqlc{
		q: db.New(d),
	}
}

func (r *pharmacyRepoSqlc) ReserveStock(ctx context.Context, itemCode string, quantity int32) error {
	return r.q.UpdateStock(ctx, db.UpdateStockParams{
		ItemCode: itemCode,
		Column2:  quantity,
	})
}

func (r *pharmacyRepoSqlc) ReleaseStock(ctx context.Context, itemCode string, quantity int32) error {
	return r.q.UpdateStock(ctx, db.UpdateStockParams{
		ItemCode: itemCode,
		Column2:  -quantity,
	})
}

func (r *pharmacyRepoSqlc) SavePrescription(ctx context.Context, prescription *domain.Prescription) error {
	_, err := r.q.CreatePrescription(ctx, db.CreatePrescriptionParams{
		ID:          prescription.ID,
		EncounterNo: prescription.EncounterNo,
		ItemCode:    prescription.ItemCode,
		Quantity:    int32(prescription.Quantity),
		Status:      prescription.Status,
		Amount:      fmt.Sprintf("%.2f", prescription.Amount),
	})
	return err
}

func (r *pharmacyRepoSqlc) GetPrescription(ctx context.Context, id string) (*domain.Prescription, error) {
	p, err := r.q.GetPrescription(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("prescription not found")
		}
		return nil, err
	}

	amountFloat, _ := strconv.ParseFloat(p.Amount, 64)

	return &domain.Prescription{
		ID:          p.ID,
		EncounterNo: p.EncounterNo,
		ItemCode:    p.ItemCode,
		Quantity:    int(p.Quantity),
		Status:      p.Status,
		Amount:      amountFloat,
	}, nil
}

func (r *pharmacyRepoSqlc) UpdatePrescriptionStatus(ctx context.Context, id, status string) error {
	_, err := r.q.UpdatePrescriptionStatus(ctx, db.UpdatePrescriptionStatusParams{
		ID:     id,
		Status: status,
	})
	return err
}
