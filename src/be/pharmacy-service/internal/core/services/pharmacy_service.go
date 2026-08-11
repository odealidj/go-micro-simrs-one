package services

import (
	"context"
	"fmt"
	"time"

	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/core/ports"
	"github.com/redis/go-redis/v9"
)

type pharmacyServiceImpl struct {
	repo        ports.PharmacyRepository
	redisClient *redis.Client
}

func NewPharmacyService(repo ports.PharmacyRepository, rdb *redis.Client) ports.PharmacyService {
	return &pharmacyServiceImpl{
		repo:        repo,
		redisClient: rdb,
	}
}

func (s *pharmacyServiceImpl) CreatePrescription(ctx context.Context, encounterNo string, isCompounded bool, notes string, diagnosis, gender, ageBracket, doctorID, departmentCode string, items []domain.PrescriptionItem) (string, error) {
	if s.repo == nil {
		return "", fmt.Errorf("repository is not initialized")
	}

	prescriptionID := fmt.Sprintf("RX-%d", time.Now().UnixNano())

	var domainItems []domain.PrescriptionItem
	for _, it := range items {
		price, err := s.repo.GetInventoryItemPrice(ctx, it.ItemCode)
		if err != nil {
			return "", fmt.Errorf("item %s not found or error: %w", it.ItemCode, err)
		}
		domainItems = append(domainItems, domain.PrescriptionItem{
			ID:             fmt.Sprintf("RX-ITM-%d", time.Now().UnixNano()),
			PrescriptionID: prescriptionID,
			ItemCode:       it.ItemCode,
			Quantity:       it.Quantity,
			Price:          price,
		})
	}

	prescription := &domain.Prescription{
		ID:             prescriptionID,
		EncounterNo:    encounterNo,
		Status:         "CREATED",
		IsCompounded:   isCompounded,
		Notes:          notes,
		Diagnosis:      diagnosis,
		Gender:         gender,
		AgeBracket:     ageBracket,
		DoctorID:       doctorID,
		DepartmentCode: departmentCode,
		Items:          domainItems,
	}

	err := s.repo.CreatePrescription(ctx, prescription)
	if err != nil {
		return "", fmt.Errorf("failed to save prescription: %w", err)
	}

	return prescriptionID, nil
}

func (s *pharmacyServiceImpl) DispensePrescription(ctx context.Context, prescriptionID string) error {
	if s.repo == nil {
		return fmt.Errorf("repository is not initialized")
	}
	
	prescription, err := s.repo.GetPrescription(ctx, prescriptionID)
	if err != nil {
		return fmt.Errorf("failed to get prescription: %w", err)
	}

	paymentStatus, err := s.repo.GetEncounterPaymentStatus(ctx, prescription.EncounterNo)
	if err != nil {
		return fmt.Errorf("failed to get payment status: %w", err)
	}

	if paymentStatus != "PAID" {
		return fmt.Errorf("cannot dispense prescription: invoice is not PAID yet (status: %s)", paymentStatus)
	}

	err = s.repo.DispensePrescription(ctx, prescriptionID)
	if err != nil {
		return err
	}

	// Publish event to Redis for SSE Queue updates
	if s.redisClient != nil {
		payload := `{"prescription_id":"` + prescriptionID + `", "encounter_no":"` + prescription.EncounterNo + `", "status":"DISPENSED", "type":"PHARMACY"}`
		s.redisClient.Publish(ctx, "queue:pharmacy:stream", payload)
	}

	return nil
}

func (s *pharmacyServiceImpl) RollbackPrescription(ctx context.Context, prescriptionID string) error {
	if s.repo == nil {
		return fmt.Errorf("repository is not initialized")
	}

	prescription, err := s.repo.GetPrescription(ctx, prescriptionID)
	if err != nil {
		return err
	}

	if prescription.Status == "ROLLBACKED" {
		return nil
	}
	
	// If it was already dispensed, we might need to add stock back.
	if prescription.Status == "DISPENSED" {
		for _, item := range prescription.Items {
			err = s.repo.DeductStock(ctx, item.ItemCode, -item.Quantity)
			if err != nil {
				return fmt.Errorf("failed to add back stock for %s: %w", item.ItemCode, err)
			}
		}
	}

	return s.repo.UpdatePrescriptionStatus(ctx, prescriptionID, "ROLLBACKED")
}

func (s *pharmacyServiceImpl) EstimateWaitTime(ctx context.Context, doctorID, departmentCode, gender, ageBracket string, isCompounded bool) (int64, error) {
	if s.repo != nil {
		return s.repo.EstimateWaitTime(ctx, doctorID, departmentCode, gender, ageBracket, isCompounded)
	}
	return 10, nil
}
