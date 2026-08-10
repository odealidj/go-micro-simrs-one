package services

import (
	"context"
	"fmt"
	"time"

	"github.com/aliube/go-micro-simrs-one/patient-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/patient-service/internal/core/ports"
	"github.com/redis/go-redis/v9"
)

type patientServiceImpl struct {
	repo        ports.PatientRepository
	redisClient *redis.Client
}

func NewPatientService(repo ports.PatientRepository, rdb *redis.Client) ports.PatientService {
	return &patientServiceImpl{
		repo:        repo,
		redisClient: rdb,
	}
}

func (s *patientServiceImpl) generateMRN(ctx context.Context) (string, error) {
	// 1. Increment sequence in Redis
	// Key: seq:patient:mrn
	seq, err := s.redisClient.Incr(ctx, "seq:patient:mrn").Result()
	if err != nil {
		return "", err
	}

	// 2. Format MRN (10-XX-XX-XX)
	// Base padding 7 digits, e.g., 0000001
	// Prefix '1' means outpatient (rawat jalan), giving 10000001
	// Formatted: 10-00-00-01
	rawStr := fmt.Sprintf("1%07d", seq)
	formattedMRN := fmt.Sprintf("%s-%s-%s-%s", rawStr[0:2], rawStr[2:4], rawStr[4:6], rawStr[6:8])
	
	return formattedMRN, nil
}

func (s *patientServiceImpl) RegisterPatient(ctx context.Context, name, nik, dob string) (string, error) {
	mrn, err := s.generateMRN(ctx)
	if err != nil {
		return "", err
	}

	patient := &domain.Patient{
		MRN:       mrn,
		Name:      name,
		NIK:       nik,
		DOB:       dob,
		CreatedAt: time.Now(),
	}

	if s.repo != nil {
		err = s.repo.Save(ctx, patient)
		if err != nil {
			return "", err
		}
	}

	return mrn, nil
}

func (s *patientServiceImpl) GetPatientByMRN(ctx context.Context, mrn string) (*domain.Patient, error) {
	if s.repo != nil {
		return s.repo.FindByMRN(ctx, mrn)
	}
	return nil, fmt.Errorf("repository not initialized")
}
