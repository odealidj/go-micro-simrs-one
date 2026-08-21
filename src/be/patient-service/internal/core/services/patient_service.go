package services

import (
	"context"
	"errors"
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
	key := "seq:patient:mrn"
	seq, err := s.redisClient.Incr(ctx, key).Result()
	if err != nil {
		return "", err
	}

	// 2. If seq is 1, it might mean Redis restarted. Fallback to DB.
	if seq == 1 && s.repo != nil {
		maxSeq, errRepo := s.repo.GetMaxMRNSequence(ctx)
		if errRepo == nil && maxSeq > 0 {
			// Sync Redis with maxSeq
			err = s.redisClient.Set(ctx, key, maxSeq+1, 0).Err()
			if err != nil {
				return "", fmt.Errorf("failed to sync redis sequence: %w", err)
			}
			seq = maxSeq + 1
		}
	}

	// 3. Format MRN (10-XX-XX-XX)
	// Base padding 7 digits, e.g., 0000001
	// Prefix '1' means outpatient (rawat jalan), giving 10000001
	// Formatted: 10-00-00-01
	rawStr := fmt.Sprintf("1%07d", seq)
	formattedMRN := fmt.Sprintf("%s-%s-%s-%s", rawStr[0:2], rawStr[2:4], rawStr[4:6], rawStr[6:8])
	
	return formattedMRN, nil
}

func (s *patientServiceImpl) RegisterPatient(ctx context.Context, name, nik, dob, gender, birthPlace, address, photoURL, email, userID string) (string, error) {
	if s.repo != nil {
		existingPatient, err := s.repo.FindByNIK(ctx, nik)
		if err == nil && existingPatient != nil {
			return "", errors.New("patient already exists")
		}
	}

	mrn, err := s.generateMRN(ctx)
	if err != nil {
		return "", err
	}

	patient := &domain.Patient{
		MRN:        mrn,
		Name:       name,
		NIK:        nik,
		DOB:        dob,
		Gender:     gender,
		BirthPlace: birthPlace,
		Address:    address,
		PhotoURL:   photoURL,
		Email:      email,
		UserID:     userID,
		CreatedAt:  time.Now(),
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

func (s *patientServiceImpl) SearchPatients(ctx context.Context, page, pageSize int, search string) ([]*domain.Patient, int, error) {
	if s.repo == nil {
		return nil, 0, fmt.Errorf("repository not initialized")
	}
	
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}
	
	offset := (page - 1) * pageSize
	return s.repo.ListPatients(ctx, pageSize, offset, search)
}

func (s *patientServiceImpl) DeletePatient(ctx context.Context, mrn string) error {
	if s.repo == nil {
		return fmt.Errorf("repository not initialized")
	}
	return s.repo.DeletePatient(ctx, mrn)
}
