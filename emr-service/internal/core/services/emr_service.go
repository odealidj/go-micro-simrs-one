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
	// For now, simulate success
	return nil
}

func (s *emrServiceImpl) AddDiagnosis(ctx context.Context, encounterNo, icd10Code, notes string) error {
	if s.repo != nil {
		return s.repo.AddDiagnosis(ctx, encounterNo, icd10Code, notes)
	}
	return nil
}

func (s *emrServiceImpl) GetMedicalRecord(ctx context.Context, encounterNo string) (*domain.MedicalRecord, error) {
	if s.repo != nil {
		return s.repo.GetMedicalRecord(ctx, encounterNo)
	}
	// Mock response
	return &domain.MedicalRecord{
		EncounterNo: encounterNo,
		MRN:         "MOCK-MRN",
		ICD10Codes:  []string{"A00.0"},
		Notes:       "Mock notes",
	}, nil
}
