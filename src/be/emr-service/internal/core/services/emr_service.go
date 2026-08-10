package services

import (
	"context"
	"log"

	"github.com/aliube/go-micro-simrs-one/emr-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/emr-service/internal/core/ports"
)

type emrServiceImpl struct {
	repo ports.EMRRepository
}

func NewEMRService(repo ports.EMRRepository) ports.EMRService {
	return &emrServiceImpl{repo: repo}
}

func (s *emrServiceImpl) CreateDraftMR(ctx context.Context, encounterNo, mrn string) error {
	log.Printf("Creating Draft MR for Encounter: %s, MRN: %s", encounterNo, mrn)
	if s.repo != nil {
		return s.repo.CreateDraft(ctx, encounterNo, mrn)
	}
	return nil
}

func (s *emrServiceImpl) SubmitTriage(ctx context.Context, encounterNo string, systolic, diastolic *int32, temp *float64, heartRate *int32, notes string) error {
	if s.repo != nil {
		return s.repo.UpdateTriage(ctx, encounterNo, systolic, diastolic, temp, heartRate, notes)
	}
	return nil
}

func (s *emrServiceImpl) AddDiagnosis(ctx context.Context, encounterNo, icd10Code, notes string) error {
	if s.repo != nil {
		return s.repo.AddDiagnosis(ctx, encounterNo, icd10Code, notes)
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
