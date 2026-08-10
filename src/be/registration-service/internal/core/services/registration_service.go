package services

import (
	"context"
	"fmt"
	"time"

	"github.com/aliube/go-micro-simrs-one/registration-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/registration-service/internal/core/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/queue"
	"github.com/redis/go-redis/v9"
)

type registrationServiceImpl struct {
	repo        ports.RegistrationRepository
	redisClient *redis.Client
	estimator   queue.QueueEstimator
}

func NewRegistrationService(repo ports.RegistrationRepository, rdb *redis.Client, estimator queue.QueueEstimator) ports.RegistrationService {
	return &registrationServiceImpl{
		repo:        repo,
		redisClient: rdb,
		estimator:   estimator,
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

	// 3. Set expiry to 32 days if it's newly created, so Redis doesn't bloat
	if seq == 1 {
		s.redisClient.Expire(ctx, key, 32*24*time.Hour)
	}

	// 4. Format Encounter No: YYYYMM + deptCode + 4 digit sequence
	// Example: 202608 + IGD + 0001 => 202608IGD0001
	encounterNo := fmt.Sprintf("%s%s%04d", yearMonth, deptCode, seq)
	
	return encounterNo, nil
}

func (s *registrationServiceImpl) RegisterEncounter(ctx context.Context, mrn, departmentCode, doctorID string) (string, int32, error) {
	encounterNo, err := s.generateEncounterNo(ctx, departmentCode)
	if err != nil {
		return "", 0, err
	}

	encounter := &domain.Encounter{
		EncounterNo: encounterNo,
		MRN:         mrn,
		Department:  departmentCode,
		DoctorID:    doctorID,
		Status:      "REGISTERED",
		CreatedAt:   time.Now(),
	}

	// Get real queue position from DB: count of REGISTERED encounters today for this dept
	var currentQueuePosition int64 = 1
	if s.repo != nil {
		count, err := s.repo.CountActiveEncountersByDept(ctx, departmentCode)
		if err == nil {
			// +1 because the current patient being registered is not yet saved
			currentQueuePosition = count + 1
		}
	}
	var waitMinutes int32 = 0
	if s.estimator != nil {
		waitTime, err := s.estimator.EstimateWaitTime(ctx, departmentCode, int(currentQueuePosition))
		if err == nil {
			waitMinutes = int32(waitTime.Minutes())
		}
	}

	// Create Outbox Event to be processed by a background Relay worker
	outboxEvent := &domain.OutboxEvent{
		ID:        fmt.Sprintf("evt-%d", time.Now().UnixNano()),
		Aggregate: "Encounter",
		Type:      "EncounterRegistered",
		Payload:   fmt.Sprintf(`{"encounter_no":"%s","mrn":"%s"}`, encounterNo, mrn),
		Status:    "PENDING",
		CreatedAt: time.Now(),
	}

	// In a real application, saving to the database and writing to the Outbox table
	// would happen in a single SQL transaction here.
	if s.repo != nil {
		err = s.repo.SaveEncounter(ctx, encounter)
		if err != nil {
			return "", 0, err
		}

		err = s.repo.SaveOutboxEvent(ctx, outboxEvent)
		if err != nil {
			return "", 0, err
		}
	}

	return encounterNo, waitMinutes, nil
}
