package services

import (
	"context"
	"log/slog"

	"github.com/aliube/go-micro-simrs-one/emr-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/emr-service/internal/core/ports"
	"github.com/redis/go-redis/v9"
)

type emrServiceImpl struct {
	repo        ports.EMRRepository
	redisClient *redis.Client
}

func NewEMRService(repo ports.EMRRepository, rdb *redis.Client) ports.EMRService {
	return &emrServiceImpl{repo: repo, redisClient: rdb}
}

func (s *emrServiceImpl) CreateDraftMR(ctx context.Context, encounterNo, mrn string) error {
	slog.Info("Creating Draft MR", "encounterNo", encounterNo, "mrn", mrn)
	if s.repo != nil {
		return s.repo.CreateDraft(ctx, encounterNo, mrn)
	}
	return nil
}

func (s *emrServiceImpl) StartEncounter(ctx context.Context, encounterNo string) error {
	slog.Info("Starting Encounter", "encounterNo", encounterNo)
	if s.repo != nil {
		err := s.repo.StartEncounter(ctx, encounterNo)
		if err != nil {
			return err
		}
		
		// Publish event to Redis for SSE Queue updates
		if s.redisClient != nil {
			payload := `{"encounter_no":"` + encounterNo + `", "status":"IN_PROGRESS", "type":"CLINIC"}`
			s.redisClient.Publish(ctx, "queue:clinic:stream", payload)
		}
		return nil
	}
	return nil
}

func (s *emrServiceImpl) SubmitTriage(ctx context.Context, encounterNo string, systolic, diastolic *int32, temp *float64, heartRate *int32, notes string) error {
	if s.repo != nil {
		return s.repo.UpdateTriage(ctx, encounterNo, systolic, diastolic, temp, heartRate, notes)
	}
	return nil
}

func (s *emrServiceImpl) AddDiagnosis(ctx context.Context, encounterNo, icd10Code, notes, doctorId, deptCode, gender, ageBracket string) error {
	if s.repo != nil {
		err := s.repo.AddDiagnosis(ctx, encounterNo, icd10Code, notes, doctorId, deptCode, gender, ageBracket)
		if err != nil {
			return err
		}
		
		// Publish event to Redis for SSE Queue updates
		if s.redisClient != nil {
			payload := `{"encounter_no":"` + encounterNo + `", "status":"COMPLETED", "type":"CLINIC"}`
			s.redisClient.Publish(ctx, "queue:clinic:stream", payload)
		}
		return nil
	}
	return nil
}

func (s *emrServiceImpl) AddMedicalAction(ctx context.Context, encounterNo, actionCode, actionName string, price float64, notes string) error {
	if s.repo != nil {
		mr, err := s.repo.GetMedicalRecord(ctx, encounterNo)
		if err != nil {
			return err
		}
		return s.repo.AddMedicalAction(ctx, encounterNo, mr.ID, actionCode, actionName, price, notes)
	}
	return nil
}

func (s *emrServiceImpl) GetMedicalRecord(ctx context.Context, encounterNo string) (*domain.MedicalRecord, error) {
	if s.repo != nil {
		return s.repo.GetMedicalRecord(ctx, encounterNo)
	}
	return nil, nil
}

func (s *emrServiceImpl) EstimateWaitTime(ctx context.Context, doctorID, deptCode, gender, ageBracket string) (int64, error) {
	if s.repo != nil {
		return s.repo.EstimateWaitTime(ctx, doctorID, deptCode, gender, ageBracket)
	}
	return 15, nil
}

