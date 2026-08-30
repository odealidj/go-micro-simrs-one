package services

import (
	"context"
	"fmt"
	"time"

	"github.com/aliube/go-micro-simrs-one/registration-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/registration-service/internal/core/ports"
	"github.com/redis/go-redis/v9"
)

type registrationServiceImpl struct {
	repo        ports.RegistrationRepository
	redisClient *redis.Client
}

func NewRegistrationService(repo ports.RegistrationRepository, rdb *redis.Client, _ interface{}) ports.RegistrationService {
	return &registrationServiceImpl{
		repo:        repo,
		redisClient: rdb,
	}
}

func (s *registrationServiceImpl) generateEncounterNo(ctx context.Context, deptCode string) (string, error) {
	// 1. Get current Year and Month
	now := time.Now()
	yearMonth := now.Format("200601") // format YYYYMM

	// 2. Increment sequence in Redis (resets monthly implicitly because key contains yearMonth)
	key := fmt.Sprintf("seq:encounter:%s", yearMonth)
	
	seq, err := s.redisClient.Incr(ctx, key).Result()
	if err != nil {
		return "", err
	}

	// 3. If seq is 1, it might be a new month or Redis restarted. Fallback to DB.
	if seq == 1 {
		maxSeq, errRepo := s.repo.GetMaxSequenceForMonth(ctx, yearMonth)
		if errRepo == nil && maxSeq > 0 {
			// Sync Redis with maxSeq
			err = s.redisClient.Set(ctx, key, maxSeq+1, 32*24*time.Hour).Err()
			if err != nil {
				return "", fmt.Errorf("failed to sync redis sequence: %w", err)
			}
			seq = int64(maxSeq + 1)
		} else {
			// Actually fresh, just set expiry
			s.redisClient.Expire(ctx, key, 32*24*time.Hour)
		}
	}

	// 4. Format Encounter No: YYYYMM + deptCode + 4 digit sequence
	// Example: 202608 + 01 + 0001 => 202608010001
	encounterNo := fmt.Sprintf("%s%s%04d", yearMonth, deptCode, seq)
	
	return encounterNo, nil
}

func (s *registrationServiceImpl) RegisterEncounter(ctx context.Context, mrn, departmentCode, doctorID, perawatID, guarantor string) (string, error) {
	// Auto-assign doctor if not provided
	if doctorID == "" && s.repo != nil {
		if activeDoc, err := s.repo.GetActiveDoctorByPoli(ctx, departmentCode); err == nil && activeDoc != "" {
			doctorID = activeDoc
		}
	}
	if doctorID == "" {
		return "", fmt.Errorf("tidak ada dokter yang bertugas di poliklinik %s pada hari ini", departmentCode)
	}

	// Auto-assign perawat based on poli mapping if not provided
	if perawatID == "" && s.repo != nil {
		if activePerawat, err := s.repo.GetActivePerawatByPoli(ctx, departmentCode); err == nil && activePerawat != "" {
			perawatID = activePerawat
		}
	}

	encounterNo, err := s.generateEncounterNo(ctx, departmentCode)
	if err != nil {
		return "", err
	}

	status := "REGISTERED"
	if guarantor == "Umum" {
		status = "WAITING_FOR_PAYMENT"
	} else if guarantor == "BPJS" {
		status = "QUEUED_FOR_POLI"
	}

	encounter := &domain.Encounter{
		EncounterNo: encounterNo,
		MRN:         mrn,
		Department:  departmentCode,
		DoctorID:    doctorID,
		PerawatID:   perawatID,
		Status:      status,
		CreatedAt:   time.Now(),
	}

	// Create Outbox Event to be processed by a background Relay worker
	outboxEvent := &domain.OutboxEvent{
		ID:        fmt.Sprintf("evt-%d", time.Now().UnixNano()),
		Aggregate: "Encounter",
		Type:      "EncounterRegistered",
		Payload:   fmt.Sprintf(`{"encounter_no":"%s","mrn":"%s","doctor_id":"%s","perawat_id":"%s"}`, encounterNo, mrn, doctorID, perawatID),
		Status:    "PENDING",
		CreatedAt: time.Now(),
	}

	// In a real application, saving to the database and writing to the Outbox table
	// would happen in a single SQL transaction here.
	if s.repo != nil {
		err = s.repo.SaveEncounter(ctx, encounter)
		if err != nil {
			return "", err
		}

		err = s.repo.SaveOutboxEvent(ctx, outboxEvent)
		if err != nil {
			return "", err
		}
	}

	return encounterNo, nil
}

func (s *registrationServiceImpl) GetTodayEncounters(ctx context.Context, startDate, endDate time.Time) ([]*domain.Encounter, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("repository is not initialized")
	}
	return s.repo.GetTodayEncounters(ctx, startDate, endDate)
}

func (s *registrationServiceImpl) CancelEncounter(ctx context.Context, encounterNo, reason string) error {
	if s.repo == nil {
		return fmt.Errorf("repository is not initialized")
	}
	
	err := s.repo.UpdateEncounterStatus(ctx, encounterNo, "CANCELLED")
	if err != nil {
		return err
	}

	// Create Outbox Event
	outboxEvent := &domain.OutboxEvent{
		ID:        fmt.Sprintf("evt-%d", time.Now().UnixNano()),
		Aggregate: "Encounter",
		Type:      "EncounterCancelled",
		Payload:   fmt.Sprintf(`{"encounter_no":"%s","reason":"%s"}`, encounterNo, reason),
		Status:    "PENDING",
		CreatedAt: time.Now(),
	}

	return s.repo.SaveOutboxEvent(ctx, outboxEvent)
}

func (s *registrationServiceImpl) UpdateEncounterStatus(ctx context.Context, encounterNo, status string) error {
	if s.repo == nil {
		return fmt.Errorf("repository is not initialized")
	}
	return s.repo.UpdateEncounterStatus(ctx, encounterNo, status)
}

func (s *registrationServiceImpl) GetDashboardMetrics(ctx context.Context, targetDate time.Time) (int32, int32, map[string]int32, map[string]int32, error) {
	if s.repo == nil {
		return 0, 0, nil, nil, fmt.Errorf("repository is not initialized")
	}
	return s.repo.GetDashboardMetrics(ctx, targetDate)
}

func (s *registrationServiceImpl) UpdateEncounterGuarantor(ctx context.Context, encounterNo, guarantor string) error {
	if s.repo == nil {
		return fmt.Errorf("repository is not initialized")
	}
	return s.repo.UpdateGuarantor(ctx, encounterNo, guarantor)
}

func (s *registrationServiceImpl) UpdatePaymentStatus(ctx context.Context, encounterNo, status string) error {
	if s.repo == nil {
		return fmt.Errorf("repository is not initialized")
	}
	return s.repo.UpdatePaymentStatus(ctx, encounterNo, status)
}

