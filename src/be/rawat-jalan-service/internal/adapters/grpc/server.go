package grpc

import (
	"context"
	"strconv"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/aliube/go-micro-simrs-one/rawat-jalan-service/internal/adapters/db"
	"github.com/aliube/go-micro-simrs-one/rawat-jalan-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/rawat-jalan-service/internal/core/ports"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/rawat_jalan/v1"
)

type RawatJalanGrpcServer struct {
	pb.UnimplementedRawatJalanServiceServer
	emrService ports.EMRService
	queries    *db.Queries
}

func NewRawatJalanGrpcServer(service ports.EMRService, queries *db.Queries) *RawatJalanGrpcServer {
	return &RawatJalanGrpcServer{
		emrService: service,
		queries:    queries,
	}
}

// ─── 1. Encounter Lifecycle & Point-of-Care ──────────────────────────────────

func (s *RawatJalanGrpcServer) StartEncounter(ctx context.Context, req *pb.StartEncounterRequest) (*pb.StartEncounterResponse, error) {
	err := s.emrService.StartEncounter(ctx, req.EncounterNo)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to start encounter: %v", err)
	}
	return &pb.StartEncounterResponse{
		Success: true,
		Message: "Encounter started",
	}, nil
}

func (s *RawatJalanGrpcServer) CompleteEncounter(ctx context.Context, req *pb.CompleteEncounterRequest) (*pb.CompleteEncounterResponse, error) {
	err := s.emrService.CompleteEncounter(ctx, req.EncounterNo)
	if err != nil {
		if strings.Contains(err.Error(), "validasi") || strings.Contains(err.Error(), "wajib") {
			return nil, status.Errorf(codes.FailedPrecondition, "%v", err)
		}
		return nil, status.Errorf(codes.Internal, "failed to complete encounter: %v", err)
	}
	return &pb.CompleteEncounterResponse{
		Success: true,
		Message: "Encounter completed successfully",
	}, nil
}

func (s *RawatJalanGrpcServer) GetMedicalRecord(ctx context.Context, req *pb.GetMedicalRecordRequest) (*pb.GetMedicalRecordResponse, error) {
	mr, err := s.emrService.GetMedicalRecord(ctx, req.EncounterNo)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "failed to get medical record: %v", err)
	}

	var triage *pb.TriageData
	hasTriageData := mr.Triage.BloodPressureSystolic != nil ||
		mr.Triage.BloodPressureDiastolic != nil ||
		mr.Triage.HeartRate != nil ||
		mr.Triage.Temperature != nil ||
		mr.Triage.RespiratoryRate != nil ||
		mr.Triage.OxygenSaturation != nil ||
		mr.Triage.Height != nil ||
		mr.Triage.Weight != nil ||
		mr.Triage.BMI != nil ||
		mr.Triage.Allergies != "" ||
		mr.Triage.Notes != ""

	if hasTriageData {
		var sys, dia, hr, resp, spo2 int32
		if mr.Triage.BloodPressureSystolic != nil { sys = *mr.Triage.BloodPressureSystolic }
		if mr.Triage.BloodPressureDiastolic != nil { dia = *mr.Triage.BloodPressureDiastolic }
		if mr.Triage.HeartRate != nil { hr = *mr.Triage.HeartRate }
		if mr.Triage.RespiratoryRate != nil { resp = *mr.Triage.RespiratoryRate }
		if mr.Triage.OxygenSaturation != nil { spo2 = *mr.Triage.OxygenSaturation }

		var temp, h, w, bmi float64
		if mr.Triage.Temperature != nil { temp = *mr.Triage.Temperature }
		if mr.Triage.Height != nil { h = *mr.Triage.Height }
		if mr.Triage.Weight != nil { w = *mr.Triage.Weight }
		if mr.Triage.BMI != nil { bmi = *mr.Triage.BMI }

		triage = &pb.TriageData{
			BloodPressureSystolic:  sys,
			BloodPressureDiastolic: dia,
			Temperature:            temp,
			HeartRate:              hr,
			RespiratoryRate:        resp,
			OxygenSaturation:       spo2,
			Height:                 h,
			Weight:                 w,
			Bmi:                    bmi,
			Allergies:              mr.Triage.Allergies,
			Notes:                  mr.Triage.Notes,
		}
	}

	var actions []*pb.MedicalAction
	for _, act := range mr.Actions {
		actions = append(actions, &pb.MedicalAction{
			ActionCode: act.ActionCode,
			ActionName: act.ActionName,
			Price:      act.Price,
		})
	}

	checklist := &pb.ClinicalChecklist{
		TriageCompleted:        mr.Checklist.TriageCompleted,
		DiagnosisCompleted:     mr.Checklist.DiagnosisCompleted,
		ActionsCompleted:       mr.Checklist.ActionsCompleted,
		ActionsCount:           mr.Checklist.ActionsCount,
		PrescriptionCompleted:  mr.Checklist.PrescriptionCompleted,
		PrescriptionCount:      mr.Checklist.PrescriptionCount,
		IsReadyToComplete:      mr.Checklist.IsReadyToComplete,
		MissingMandatoryFields: mr.Checklist.MissingMandatoryFields,
		BaseConsultationFee:    mr.Checklist.BaseConsultationFee,
	}

	var diagnoses []*pb.EncounterDiagnosis
	for _, d := range mr.Diagnoses {
		diagnoses = append(diagnoses, &pb.EncounterDiagnosis{
			Id:                   d.ID,
			Icd10Code:            d.ICD10Code,
			Icd10Name:            d.ICD10Name,
			DiagnosisType:        d.DiagnosisType,
			Sequence:             d.Sequence,
			ClinicalNotes:        d.ClinicalNotes,
			SeverityLevel:        d.SeverityLevel,
			SeveritySetRole:      d.SeveritySetRole,
			AutoKbmCode:          d.AutoKBMCode,
			AutoKbmName:          d.AutoKBMName,
			KbmMappingConfidence: d.KBMMappingConfidence,
			IsVerifiedByRm:       d.IsVerifiedByRM,
			VerifiedBy:           d.VerifiedBy,
		})
	}

	return &pb.GetMedicalRecordResponse{
		EncounterNo:            mr.EncounterNo,
		PatientMrn:             mr.MRN,
		Notes:                  mr.Notes,
		Status:                 mr.Status,
		Triage:                 triage,
		Diagnoses:              diagnoses,
		Actions:                actions,
		Checklist:              checklist,
		EncounterSeverityLevel: mr.EncounterSeverityLevel,
	}, nil
}

func (s *RawatJalanGrpcServer) GetEstimatedWaitTime(ctx context.Context, req *pb.GetEstimatedWaitTimeRequest) (*pb.GetEstimatedWaitTimeResponse, error) {
	est, err := s.emrService.EstimateWaitTime(ctx, req.DoctorId, req.DepartmentCode, req.Gender, req.AgeBracket)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to estimate wait time: %v", err)
	}
	return &pb.GetEstimatedWaitTimeResponse{
		EstimatedMinutes: est,
	}, nil
}

func (s *RawatJalanGrpcServer) FinalizeMedicalRecord(ctx context.Context, req *pb.FinalizeMedicalRecordRequest) (*pb.FinalizeMedicalRecordResponse, error) {
	errorsList, err := s.emrService.FinalizeMedicalRecord(ctx, req.EncounterNo, req.DoctorId)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to finalize medical record: %v", err)
	}

	success := len(errorsList) == 0
	if success {
		err = s.emrService.CompleteEncounter(ctx, req.EncounterNo)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to complete encounter: %v", err)
		}
	}

	return &pb.FinalizeMedicalRecordResponse{
		Success:          success,
		ValidationErrors: errorsList,
	}, nil
}

// ─── 2. Triage (Perawat) ───────────────────────────────────────────────────────

func (s *RawatJalanGrpcServer) SubmitTriage(ctx context.Context, req *pb.SubmitTriageRequest) (*pb.SubmitTriageResponse, error) {
	var sys, dia, hr, resp, spo2 *int32
	if req.BloodPressureSystolic > 0 { sys = &req.BloodPressureSystolic }
	if req.BloodPressureDiastolic > 0 { dia = &req.BloodPressureDiastolic }
	if req.HeartRate > 0 { hr = &req.HeartRate }
	if req.RespiratoryRate > 0 { resp = &req.RespiratoryRate }
	if req.OxygenSaturation > 0 { spo2 = &req.OxygenSaturation }

	var temp, h, w, bmi *float64
	if req.Temperature > 0 { temp = &req.Temperature }
	if req.Height > 0 { h = &req.Height }
	if req.Weight > 0 { w = &req.Weight }
	if req.Bmi > 0 { bmi = &req.Bmi }

	triageData := domain.TriageData{
		BloodPressureSystolic:  sys,
		BloodPressureDiastolic: dia,
		Temperature:            temp,
		HeartRate:              hr,
		RespiratoryRate:        resp,
		OxygenSaturation:       spo2,
		Height:                 h,
		Weight:                 w,
		BMI:                    bmi,
		Allergies:              req.Allergies,
		Notes:                  req.Notes,
	}

	err := s.emrService.SubmitTriage(ctx, req.EncounterNo, req.Mrn, triageData)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to submit triage: %v", err)
	}

	return &pb.SubmitTriageResponse{
		Success: true,
		Message: "Triage submitted successfully",
	}, nil
}

// ─── 3. Tindakan Medis ────────────────────────────────────────────────────────

func (s *RawatJalanGrpcServer) AddMedicalAction(ctx context.Context, req *pb.AddMedicalActionRequest) (*pb.AddMedicalActionResponse, error) {
	err := s.emrService.AddMedicalAction(ctx, req.EncounterNo, req.ActionCode, req.ActionName, req.Price, req.Notes)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to add medical action: %v", err)
	}

	return &pb.AddMedicalActionResponse{
		Success: true,
		Message: "Medical action added successfully",
	}, nil
}

// ─── 4. Diagnosis (Dokter - ICD-10 First) ──────────────────────────────────────

func (s *RawatJalanGrpcServer) AddEncounterDiagnosis(ctx context.Context, req *pb.AddEncounterDiagnosisRequest) (*pb.AddEncounterDiagnosisResponse, error) {
	diag, err := s.emrService.AddEncounterDiagnosis(
		ctx,
		req.EncounterNo,
		req.Icd10Code,
		req.DiagnosisType,
		req.ClinicalNotes,
		req.SeverityLevel,
		req.DoctorId,
		req.DepartmentCode,
		req.Gender,
		req.AgeBracket,
		req.Sequence,
	)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to add encounter diagnosis: %v", err)
	}

	return &pb.AddEncounterDiagnosisResponse{
		Success: true,
		Message: "Diagnosis added successfully",
		Data: &pb.EncounterDiagnosis{
			Id:                   diag.ID,
			Icd10Code:            diag.ICD10Code,
			Icd10Name:            diag.ICD10Name,
			DiagnosisType:        diag.DiagnosisType,
			Sequence:             diag.Sequence,
			ClinicalNotes:        diag.ClinicalNotes,
			SeverityLevel:        diag.SeverityLevel,
			SeveritySetRole:      diag.SeveritySetRole,
			AutoKbmCode:          diag.AutoKBMCode,
			AutoKbmName:          diag.AutoKBMName,
			KbmMappingConfidence: diag.KBMMappingConfidence,
			IsVerifiedByRm:       diag.IsVerifiedByRM,
			VerifiedBy:           diag.VerifiedBy,
		},
	}, nil
}

func (s *RawatJalanGrpcServer) UpdateEncounterDiagnosis(ctx context.Context, req *pb.UpdateEncounterDiagnosisRequest) (*pb.UpdateEncounterDiagnosisResponse, error) {
	err := s.emrService.UpdateEncounterDiagnosis(ctx, req.Id, req.DiagnosisType, req.ClinicalNotes, req.SeverityLevel, req.Sequence)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update encounter diagnosis: %v", err)
	}
	return &pb.UpdateEncounterDiagnosisResponse{
		Success: true,
		Message: "Diagnosis updated successfully",
	}, nil
}

func (s *RawatJalanGrpcServer) RemoveEncounterDiagnosis(ctx context.Context, req *pb.RemoveEncounterDiagnosisRequest) (*pb.RemoveEncounterDiagnosisResponse, error) {
	err := s.emrService.RemoveEncounterDiagnosis(ctx, req.Id)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to remove encounter diagnosis: %v", err)
	}
	return &pb.RemoveEncounterDiagnosisResponse{
		Success: true,
		Message: "Diagnosis removed successfully",
	}, nil
}

func (s *RawatJalanGrpcServer) FinalizeSeverity(ctx context.Context, req *pb.FinalizeSeverityRequest) (*pb.FinalizeSeverityResponse, error) {
	err := s.emrService.FinalizeSeverity(ctx, req.EncounterNo, req.SeverityLevel, req.UserId)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to finalize severity: %v", err)
	}
	return &pb.FinalizeSeverityResponse{
		Success: true,
		Message: "Severity finalized successfully",
	}, nil
}

func (s *RawatJalanGrpcServer) GetKBMSuggestionsForICD10(ctx context.Context, req *pb.GetKBMSuggestionsForICD10Request) (*pb.GetKBMSuggestionsForICD10Response, error) {
	suggestions, err := s.emrService.GetKBMSuggestionsForICD10(ctx, req.Icd10Code)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get KBM suggestions: %v", err)
	}

	var pbSuggestions []*pb.KBMSuggestion
	for _, sugg := range suggestions {
		pbSuggestions = append(pbSuggestions, &pb.KBMSuggestion{
			KbmCode:           sugg.KBMCode,
			KbmName:           sugg.KBMName,
			IsPrimary:         sugg.IsPrimary,
			MappingConfidence: sugg.MappingConfidence,
		})
	}

	return &pb.GetKBMSuggestionsForICD10Response{
		Suggestions: pbSuggestions,
	}, nil
}

// ─── 5. Master Data Reads (Poli-Scoped) ────────────────────────────────────────

func (s *RawatJalanGrpcServer) GetMasterTindakanByPoli(ctx context.Context, req *pb.GetMasterTindakanByPoliRequest) (*pb.GetMasterTindakanByPoliResponse, error) {
	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	res, err := s.queries.GetTindakanByPolyclinic(ctx, db.GetTindakanByPolyclinicParams{
		PolyclinicCode: req.PoliCode,
		Column2:        req.SearchName,
		Column3:        req.SearchCode,
		Limit:          pageSize,
		Offset:         offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get tindakan by poli: %v", err)
	}
	count, err := s.queries.CountTindakanByPolyclinic(ctx, db.CountTindakanByPolyclinicParams{
		PolyclinicCode: req.PoliCode,
		Column2:        req.SearchName,
		Column3:        req.SearchCode,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count tindakan by poli: %v", err)
	}

	var data []*pb.MasterTindakan
	for _, t := range res {
		basePrice, _ := strconv.ParseFloat(t.BasePrice, 64)
		data = append(data, &pb.MasterTindakan{
			KodeTindakan: t.KodeTindakan,
			NamaTindakan: t.NamaTindakan,
			BasePrice:    basePrice,
			Polyclinics:  t.Polyclinics,
			Icd9Count:    t.Icd9Count,
		})
	}
	return &pb.GetMasterTindakanByPoliResponse{Data: data, TotalCount: int32(count)}, nil
}

func (s *RawatJalanGrpcServer) GetMasterICD10ByPoli(ctx context.Context, req *pb.GetMasterICD10ByPoliRequest) (*pb.GetMasterICD10ByPoliResponse, error) {
	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	res, err := s.queries.GetICD10ByPolyclinic(ctx, db.GetICD10ByPolyclinicParams{
		PolyclinicCode: req.PoliCode,
		Column2:        req.SearchName,
		Column3:        req.SearchCode,
		Limit:          pageSize,
		Offset:         offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get icd10 by poli: %v", err)
	}
	count, err := s.queries.CountICD10ByPolyclinic(ctx, db.CountICD10ByPolyclinicParams{
		PolyclinicCode: req.PoliCode,
		Column2:        req.SearchName,
		Column3:        req.SearchCode,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count icd10 by poli: %v", err)
	}

	var data []*pb.MasterICD10
	for _, i := range res {
		data = append(data, &pb.MasterICD10{
			Icd10Code:   i.Icd10Code,
			NameEn:      i.NameEn,
			NameId:      i.NameID,
			ChapterCode: i.ChapterCode.String,
			BlockCode:   i.BlockCode.String,
			IsActive:    i.IsActive.Bool,
			Polyclinics: i.Polyclinics,
			KbmCount:    i.KbmCount,
			SnomedCount: i.SnomedCount,
		})
	}
	return &pb.GetMasterICD10ByPoliResponse{Data: data, TotalCount: int32(count)}, nil
}

func (s *RawatJalanGrpcServer) GetMasterKBMsByPoli(ctx context.Context, req *pb.GetMasterKBMsByPoliRequest) (*pb.GetMasterKBMsByPoliResponse, error) {
	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	res, err := s.queries.GetKBMsByPolyclinic(ctx, db.GetKBMsByPolyclinicParams{
		PolyclinicCode: req.PoliCode,
		Column2:        req.SearchName,
		Column3:        req.SearchCode,
		Limit:          pageSize,
		Offset:         offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get KBM by poli: %v", err)
	}
	count, err := s.queries.CountKBMsByPolyclinic(ctx, db.CountKBMsByPolyclinicParams{
		PolyclinicCode: req.PoliCode,
		Column2:        req.SearchName,
		Column3:        req.SearchCode,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count KBM by poli: %v", err)
	}

	var data []*pb.KBMItem
	for _, k := range res {
		data = append(data, &pb.KBMItem{
			KbmCode:     k.KbmCode,
			KbmName:     k.KbmName,
			Description: k.Description.String,
			BodySystem:  k.BodySystem.String,
			Polyclinics: k.Polyclinics,
			Icd10Count:  k.Icd10Count,
		})
	}
	return &pb.GetMasterKBMsByPoliResponse{Data: data, TotalCount: int32(count)}, nil
}

func (s *RawatJalanGrpcServer) SearchKBM(ctx context.Context, req *pb.SearchKBMRequest) (*pb.SearchKBMResponse, error) {
	limit := req.Limit
	if limit == 0 {
		limit = 20
	}
	items, total, err := s.emrService.SearchKBM(ctx, req.DepartmentCode, req.Query, limit, req.Offset)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to search KBM: %v", err)
	}

	var pbItems []*pb.KBMItem
	for _, it := range items {
		pbItems = append(pbItems, &pb.KBMItem{
			KbmCode:     it.KBMCode,
			KbmName:     it.KBMName,
			Description: it.Description,
			BodySystem:  it.BodySystem,
		})
	}

	return &pb.SearchKBMResponse{
		Items: pbItems,
		Total: total,
	}, nil
}

func (s *RawatJalanGrpcServer) GetKBMDetail(ctx context.Context, req *pb.GetKBMDetailRequest) (*pb.GetKBMDetailResponse, error) {
	item, err := s.emrService.GetKBMDetail(ctx, req.KbmCode)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "KBM not found: %v", err)
	}

	return &pb.GetKBMDetailResponse{
		Item: &pb.KBMItem{
			KbmCode:     item.KBMCode,
			KbmName:     item.KBMName,
			Description: item.Description,
			BodySystem:  item.BodySystem,
		},
	}, nil
}
