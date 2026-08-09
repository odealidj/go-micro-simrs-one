package services

import (
	"context"
	"fmt"
	"time"

	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/core/ports"
)

type pharmacyServiceImpl struct {
	repo ports.PharmacyRepository
}

func NewPharmacyService(repo ports.PharmacyRepository) ports.PharmacyService {
	return &pharmacyServiceImpl{repo: repo}
}

func (s *pharmacyServiceImpl) Prescribe(ctx context.Context, encounterNo, itemCode string, quantity int32) (*domain.Prescription, error) {
	// 1. Reserve Stock (Pessimistic Lock via Repo)
	if s.repo != nil {
		err := s.repo.ReserveStock(ctx, itemCode, quantity)
		if err != nil {
			return nil, fmt.Errorf("failed to reserve stock: %w", err)
		}
	}

	// 2. Create Prescription with RESERVED status
	prescription := &domain.Prescription{
		ID:          fmt.Sprintf("RX-%d", time.Now().UnixNano()),
		EncounterNo: encounterNo,
		ItemCode:    itemCode,
		Quantity:    quantity,
		Status:      "RESERVED",
		Amount:      float64(quantity) * 15000.0, // Mock price
		CreatedAt:   time.Now(),
	}

	if s.repo != nil {
		err := s.repo.SavePrescription(ctx, prescription)
		if err != nil {
			return nil, err
		}
	}

	return prescription, nil
}

func (s *pharmacyServiceImpl) RollbackPrescription(ctx context.Context, prescriptionID string) error {
	if s.repo == nil {
		return nil
	}
	
	prescription, err := s.repo.GetPrescription(ctx, prescriptionID)
	if err != nil {
		return err
	}

	if prescription.Status == "ROLLBACKED" {
		return nil // already rollbacked
	}

	// Release stock
	err = s.repo.ReleaseStock(ctx, prescription.ItemCode, prescription.Quantity)
	if err != nil {
		return fmt.Errorf("failed to release stock: %w", err)
	}

	// Update status
	return s.repo.UpdatePrescriptionStatus(ctx, prescriptionID, "ROLLBACKED")
}
