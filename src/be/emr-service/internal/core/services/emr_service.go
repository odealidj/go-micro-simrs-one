package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

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

func (s *emrServiceImpl) AddEncounterDiagnosis(ctx context.Context, encounterNo, icd10Code, diagType, notes, severity, doctorId, deptCode, gender, ageBracket string, sequence int32) (*domain.EncounterDiagnosis, error) {
	if s.repo != nil {
		return s.repo.AddEncounterDiagnosis(ctx, encounterNo, icd10Code, diagType, notes, severity, doctorId, deptCode, gender, ageBracket, sequence)
	}
	return nil, nil
}

func (s *emrServiceImpl) UpdateEncounterDiagnosis(ctx context.Context, id, diagType, notes, severity string, sequence int32) error {
	if s.repo != nil {
		return s.repo.UpdateEncounterDiagnosis(ctx, id, diagType, notes, severity, sequence)
	}
	return nil
}

func (s *emrServiceImpl) RemoveEncounterDiagnosis(ctx context.Context, id string) error {
	if s.repo != nil {
		return s.repo.RemoveEncounterDiagnosis(ctx, id)
	}
	return nil
}

func (s *emrServiceImpl) CompleteEncounter(ctx context.Context, encounterNo string) error {
	slog.Info("Completing Encounter with Clinical Validation", "encounterNo", encounterNo)
	if s.repo != nil {
		mr, err := s.repo.GetMedicalRecord(ctx, encounterNo)
		if err != nil {
			return err
		}
		if mr == nil {
			return errors.New("rekam medis encounter tidak ditemukan")
		}

		if !mr.Checklist.IsReadyToComplete {
			return fmt.Errorf("validasi kelengkapan gagal: %s wajib diisi sebelum menyelesaikan pemeriksaan", strings.Join(mr.Checklist.MissingMandatoryFields, " dan "))
		}

		err = s.repo.CompleteEncounter(ctx, encounterNo)
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

func (s *emrServiceImpl) SearchKBM(ctx context.Context, deptCode, query string, limit, offset int32) ([]*domain.KBMItem, int32, error) {
	if s.repo != nil {
		cacheKey := fmt.Sprintf("cache:kbm:poly:%s:q:%s:limit:%d:offset:%d", deptCode, query, limit, offset)
		if deptCode == "" {
			cacheKey = fmt.Sprintf("cache:kbm:global:q:%s:limit:%d:offset:%d", query, limit, offset)
		}

		if s.redisClient != nil {
			cachedData, err := s.redisClient.Get(ctx, cacheKey).Result()
			if err == nil && cachedData != "" {
				var result struct {
					Items []*domain.KBMItem `json:"items"`
					Total int32             `json:"total"`
				}
				if jsonErr := json.Unmarshal([]byte(cachedData), &result); jsonErr == nil {
					return result.Items, result.Total, nil
				}
			}
		}

		items, total, err := s.repo.SearchKBM(ctx, deptCode, query, limit, offset)
		if err != nil {
			return nil, 0, err
		}

		if s.redisClient != nil && err == nil {
			result := struct {
				Items []*domain.KBMItem `json:"items"`
				Total int32             `json:"total"`
			}{Items: items, Total: total}
			
			if jsonData, err := json.Marshal(result); err == nil {
				// Cache for 24 hours since KBM rarely changes
				s.redisClient.Set(ctx, cacheKey, string(jsonData), 24*time.Hour)
			}
		}

		return items, total, nil
	}
	return nil, 0, nil
}

func (s *emrServiceImpl) GetKBMDetail(ctx context.Context, kbmCode string) (*domain.KBMItem, error) {
	if s.repo != nil {
		return s.repo.GetKBMDetail(ctx, kbmCode)
	}
	return nil, nil
}

func (s *emrServiceImpl) GetKBMSuggestionsForICD10(ctx context.Context, icd10Code string) ([]*domain.KBMSuggestion, error) {
	if s.repo != nil {
		return s.repo.GetKBMSuggestionsForICD10(ctx, icd10Code)
	}
	return nil, nil
}

func (s *emrServiceImpl) ListPendingKBMVerifications(ctx context.Context, limit, offset int32) ([]*domain.PendingVerification, int32, error) {
	if s.repo != nil {
		return s.repo.ListPendingKBMVerifications(ctx, limit, offset)
	}
	return nil, 0, nil
}

func (s *emrServiceImpl) VerifyKBMMapping(ctx context.Context, id, kbmCode, userId string) error {
	if s.repo != nil {
		return s.repo.VerifyKBMMapping(ctx, id, kbmCode, userId)
	}
	return nil
}

func (s *emrServiceImpl) FinalizeSeverity(ctx context.Context, encounterNo, severityLevel, userId string) error {
	if s.repo != nil {
		return s.repo.FinalizeSeverity(ctx, encounterNo, severityLevel, userId)
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

func (s *emrServiceImpl) FinalizeMedicalRecord(ctx context.Context, encounterNo, doctorId string) ([]string, error) {
	var validationErrors []string

	if s.repo == nil {
		return nil, nil
	}
	
	// 1. Triage Validation
	mr, err := s.repo.GetMedicalRecord(ctx, encounterNo)
	if err != nil {
		return nil, err
	}
	if mr.Triage.HeartRate == nil && mr.Triage.BloodPressureSystolic == nil && mr.Notes == "" {
		validationErrors = append(validationErrors, "Asesmen Triage belum diisi.")
	}

	// 2. Diagnosa Medis (Utama)
	diags, err := s.repo.GetEncounterDiagnoses(ctx, encounterNo)
	if err != nil {
		return nil, err
	}
	hasPrimary := false
	for _, d := range diags {
		if d.DiagnosisType == "PRIMARY" {
			hasPrimary = true
			break
		}
	}
	if !hasPrimary {
		validationErrors = append(validationErrors, "Diagnosa Utama (Primary) belum diisi.")
	}

	// 3. Resume/Plan check (we use medical record resume field if any, but for now we skip or add if needed)

	// 4. encounter_tindakan check (ensure \"KARCIS\" category exists and is PAID)
	// We'll check if there's any unpaid KARCIS
	unpaidKarcis, err := s.repo.CheckKarcisUnpaid(ctx, encounterNo)
	if err == nil && unpaidKarcis {
		validationErrors = append(validationErrors, "Karcis pendaftaran belum lunas/dibayar. Harap selesaikan pembayaran terlebih dahulu.")
	}
	// We might also want to check if a karcis exists at all.
	paidKarcis, err := s.repo.CheckKarcisPaid(ctx, encounterNo)
	if err == nil && !paidKarcis {
		validationErrors = append(validationErrors, "Tidak ditemukan tagihan Karcis yang sudah dibayar.")
	}

	// 5. encounter_resep check (Optional: if resep exists, just inform or validate something. We'll leave it pass if none.)

	return validationErrors, nil
}

