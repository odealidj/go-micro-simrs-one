package grpc

import (
	"context"
	"strconv"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/aliube/go-micro-simrs-one/emr-service/internal/adapters/db"
	"github.com/aliube/go-micro-simrs-one/emr-service/internal/core/ports"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/emr/v1"
)

type EMRGrpcServer struct {
	pb.UnimplementedEMRServiceServer
	emrService ports.EMRService
	queries    *db.Queries
}

func NewEMRGrpcServer(service ports.EMRService, queries *db.Queries) *EMRGrpcServer {
	return &EMRGrpcServer{
		emrService: service,
		queries:    queries,
	}
}

func (s *EMRGrpcServer) StartEncounter(ctx context.Context, req *pb.StartEncounterRequest) (*pb.StartEncounterResponse, error) {
	err := s.emrService.StartEncounter(ctx, req.EncounterNo)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to start encounter: %v", err)
	}
	return &pb.StartEncounterResponse{
		Success: true,
		Message: "Encounter started",
	}, nil
}

func (s *EMRGrpcServer) CompleteEncounter(ctx context.Context, req *pb.CompleteEncounterRequest) (*pb.CompleteEncounterResponse, error) {
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

func (s *EMRGrpcServer) SubmitTriage(ctx context.Context, req *pb.SubmitTriageRequest) (*pb.SubmitTriageResponse, error) {
	err := s.emrService.SubmitTriage(ctx, req.EncounterNo, &req.BloodPressureSystolic, &req.BloodPressureDiastolic, &req.Temperature, &req.HeartRate, req.Notes)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to submit triage: %v", err)
	}

	return &pb.SubmitTriageResponse{
		Success: true,
		Message: "Triage submitted successfully",
	}, nil
}

func (s *EMRGrpcServer) SearchKBM(ctx context.Context, req *pb.SearchKBMRequest) (*pb.SearchKBMResponse, error) {
	limit := req.Limit
	if limit == 0 {
		limit = 20
	}
	items, total, err := s.emrService.SearchKBM(ctx, req.DepartmentCode, req.Query, limit, req.Offset)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to search kbm: %v", err)
	}

	var pbItems []*pb.KBMItem
	for _, i := range items {
		pbItems = append(pbItems, &pb.KBMItem{
			KbmCode:     i.KBMCode,
			KbmName:     i.KBMName,
			Description: i.Description,
			BodySystem:  i.BodySystem,
		})
	}
	return &pb.SearchKBMResponse{
		Items: pbItems,
		Total: total,
	}, nil
}

func (s *EMRGrpcServer) GetKBMDetail(ctx context.Context, req *pb.GetKBMDetailRequest) (*pb.GetKBMDetailResponse, error) {
	i, err := s.emrService.GetKBMDetail(ctx, req.KbmCode)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "kbm not found: %v", err)
	}
	return &pb.GetKBMDetailResponse{
		Item: &pb.KBMItem{
			KbmCode:     i.KBMCode,
			KbmName:     i.KBMName,
			Description: i.Description,
			BodySystem:  i.BodySystem,
		},
	}, nil
}

func (s *EMRGrpcServer) AddEncounterDiagnosis(ctx context.Context, req *pb.AddEncounterDiagnosisRequest) (*pb.AddEncounterDiagnosisResponse, error) {
	diag, err := s.emrService.AddEncounterDiagnosis(ctx, req.EncounterNo, req.Icd10Code, req.DiagnosisType, req.ClinicalNotes, req.SeverityLevel, req.DoctorId, req.DepartmentCode, req.Gender, req.AgeBracket, req.Sequence)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to add diagnosis: %v", err)
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

func (s *EMRGrpcServer) UpdateEncounterDiagnosis(ctx context.Context, req *pb.UpdateEncounterDiagnosisRequest) (*pb.UpdateEncounterDiagnosisResponse, error) {
	err := s.emrService.UpdateEncounterDiagnosis(ctx, req.Id, req.DiagnosisType, req.ClinicalNotes, req.SeverityLevel, req.Sequence)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update diagnosis: %v", err)
	}
	return &pb.UpdateEncounterDiagnosisResponse{Success: true, Message: "Updated"}, nil
}

func (s *EMRGrpcServer) RemoveEncounterDiagnosis(ctx context.Context, req *pb.RemoveEncounterDiagnosisRequest) (*pb.RemoveEncounterDiagnosisResponse, error) {
	err := s.emrService.RemoveEncounterDiagnosis(ctx, req.Id)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to remove diagnosis: %v", err)
	}
	return &pb.RemoveEncounterDiagnosisResponse{Success: true, Message: "Removed"}, nil
}

func (s *EMRGrpcServer) GetKBMSuggestionsForICD10(ctx context.Context, req *pb.GetKBMSuggestionsForICD10Request) (*pb.GetKBMSuggestionsForICD10Response, error) {
	suggestions, err := s.emrService.GetKBMSuggestionsForICD10(ctx, req.Icd10Code)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get kbm suggestions: %v", err)
	}
	var pbSuggestions []*pb.KBMSuggestion
	for _, s := range suggestions {
		pbSuggestions = append(pbSuggestions, &pb.KBMSuggestion{
			KbmCode:           s.KBMCode,
			KbmName:           s.KBMName,
			IsPrimary:         s.IsPrimary,
			MappingConfidence: s.MappingConfidence,
		})
	}
	return &pb.GetKBMSuggestionsForICD10Response{
		Suggestions: pbSuggestions,
	}, nil
}

func (s *EMRGrpcServer) VerifyKBMMapping(ctx context.Context, req *pb.VerifyKBMMappingRequest) (*pb.VerifyKBMMappingResponse, error) {
	err := s.emrService.VerifyKBMMapping(ctx, req.Id, req.KbmCode, req.UserId)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to verify kbm mapping: %v", err)
	}
	return &pb.VerifyKBMMappingResponse{
		Success: true,
		Message: "KBM mapping verified",
	}, nil
}

func (s *EMRGrpcServer) FinalizeSeverity(ctx context.Context, req *pb.FinalizeSeverityRequest) (*pb.FinalizeSeverityResponse, error) {
	err := s.emrService.FinalizeSeverity(ctx, req.EncounterNo, req.SeverityLevel, req.UserId)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to finalize severity: %v", err)
	}
	return &pb.FinalizeSeverityResponse{
		Success: true,
		Message: "Severity finalized",
	}, nil
}

func (s *EMRGrpcServer) ListPendingKBMVerifications(ctx context.Context, req *pb.ListPendingKBMVerificationsRequest) (*pb.ListPendingKBMVerificationsResponse, error) {
	// Not implemented for MVP
	return &pb.ListPendingKBMVerificationsResponse{}, nil
}

func (s *EMRGrpcServer) AddMedicalAction(ctx context.Context, req *pb.AddMedicalActionRequest) (*pb.AddMedicalActionResponse, error) {
	err := s.emrService.AddMedicalAction(ctx, req.EncounterNo, req.ActionCode, req.ActionName, req.Price, req.Notes)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to add medical action: %v", err)
	}

	return &pb.AddMedicalActionResponse{
		Success: true,
		Message: "Medical action added successfully",
	}, nil
}

func (s *EMRGrpcServer) GetMedicalRecord(ctx context.Context, req *pb.GetMedicalRecordRequest) (*pb.GetMedicalRecordResponse, error) {
	mr, err := s.emrService.GetMedicalRecord(ctx, req.EncounterNo)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "failed to get medical record: %v", err)
	}

	var triage *pb.TriageData
	if mr.Triage.BloodPressureSystolic != nil {
		sys := *mr.Triage.BloodPressureSystolic
		dia := int32(0)
		if mr.Triage.BloodPressureDiastolic != nil {
			dia = *mr.Triage.BloodPressureDiastolic
		}
		hr := int32(0)
		if mr.Triage.HeartRate != nil {
			hr = *mr.Triage.HeartRate
		}
		temp := float64(0)
		if mr.Triage.Temperature != nil {
			temp = *mr.Triage.Temperature
		}
		triage = &pb.TriageData{
			BloodPressureSystolic:  sys,
			BloodPressureDiastolic: dia,
			Temperature:            temp,
			HeartRate:              hr,
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

func (s *EMRGrpcServer) GetEstimatedWaitTime(ctx context.Context, req *pb.GetEstimatedWaitTimeRequest) (*pb.GetEstimatedWaitTimeResponse, error) {
	est, err := s.emrService.EstimateWaitTime(ctx, req.DoctorId, req.DepartmentCode, req.Gender, req.AgeBracket)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to estimate wait time: %v", err)
	}
	return &pb.GetEstimatedWaitTimeResponse{
		EstimatedMinutes: est,
	}, nil
}

func (s *EMRGrpcServer) GetPolyclinics(ctx context.Context, req *pb.GetPolyclinicsRequest) (*pb.GetPolyclinicsResponse, error) {
	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	res, err := s.queries.GetPolyclinics(ctx, db.GetPolyclinicsParams{
		Column1: req.Search,
		Limit:   pageSize,
		Offset:  offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get polyclinics: %v", err)
	}
	count, err := s.queries.CountPolyclinics(ctx, req.Search)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count polyclinics: %v", err)
	}

	var data []*pb.Polyclinic
	for _, p := range res {
		data = append(data, &pb.Polyclinic{Code: p.Code, Name: p.Name})
	}
	return &pb.GetPolyclinicsResponse{Data: data, TotalCount: int32(count)}, nil
}

func (s *EMRGrpcServer) GetMasterKBMs(ctx context.Context, req *pb.GetMasterKBMsRequest) (*pb.GetMasterKBMsResponse, error) {
	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	res, err := s.queries.GetKBMs(ctx, db.GetKBMsParams{
		Column1: req.SearchName,
		Column2: req.SearchCode,
		Limit:   pageSize,
		Offset:  offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get kbms: %v", err)
	}
	count, err := s.queries.CountKBMs(ctx, db.CountKBMsParams{
		Column1: req.SearchName,
		Column2: req.SearchCode,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count kbms: %v", err)
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
	return &pb.GetMasterKBMsResponse{Data: data, TotalCount: int32(count)}, nil
}

func (s *EMRGrpcServer) GetMasterKBMsByPoli(ctx context.Context, req *pb.GetMasterKBMsByPoliRequest) (*pb.GetMasterKBMsByPoliResponse, error) {
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
		return nil, status.Errorf(codes.Internal, "failed to get kbms by poli: %v", err)
	}
	count, err := s.queries.CountKBMsByPolyclinic(ctx, db.CountKBMsByPolyclinicParams{
		PolyclinicCode: req.PoliCode,
		Column2:        req.SearchName,
		Column3:        req.SearchCode,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count kbms by poli: %v", err)
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

func (s *EMRGrpcServer) GetMasterTindakan(ctx context.Context, req *pb.GetMasterTindakanRequest) (*pb.GetMasterTindakanResponse, error) {
	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	res, err := s.queries.GetTindakan(ctx, db.GetTindakanParams{
		Column1: req.SearchName,
		Column2: req.SearchCode,
		Limit:   pageSize,
		Offset:  offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get tindakan: %v", err)
	}
	count, err := s.queries.CountTindakan(ctx, db.CountTindakanParams{
		Column1: req.SearchName,
		Column2: req.SearchCode,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count tindakan: %v", err)
	}

	var data []*pb.MasterTindakan
	for _, t := range res {
		basePrice, _ := strconv.ParseFloat(t.BasePrice, 64)
		data = append(data, &pb.MasterTindakan{
			KodeTindakan: t.KodeTindakan,
			NamaTindakan: t.NamaTindakan,
			BasePrice:    basePrice, // we can parse string from numeric or use Float64Value if available. wait pgtype.Numeric needs proper parsing.
			Polyclinics:  t.Polyclinics,
			Icd9Count:    t.Icd9Count,
		})
	}
	return &pb.GetMasterTindakanResponse{Data: data, TotalCount: int32(count)}, nil
}

func (s *EMRGrpcServer) GetMasterTindakanByPoli(ctx context.Context, req *pb.GetMasterTindakanByPoliRequest) (*pb.GetMasterTindakanByPoliResponse, error) {
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

func (s *EMRGrpcServer) GetMasterICD10(ctx context.Context, req *pb.GetMasterICD10Request) (*pb.GetMasterICD10Response, error) {
	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	res, err := s.queries.GetICD10(ctx, db.GetICD10Params{
		Column1: req.SearchName,
		Column2: req.SearchCode,
		Limit:   pageSize,
		Offset:  offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get icd10: %v", err)
	}
	count, err := s.queries.CountICD10(ctx, db.CountICD10Params{
		Column1: req.SearchName,
		Column2: req.SearchCode,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count icd10: %v", err)
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
	return &pb.GetMasterICD10Response{Data: data, TotalCount: int32(count)}, nil
}

func (s *EMRGrpcServer) GetMasterICD10ByPoli(ctx context.Context, req *pb.GetMasterICD10ByPoliRequest) (*pb.GetMasterICD10ByPoliResponse, error) {
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

func (s *EMRGrpcServer) GetMasterICD9(ctx context.Context, req *pb.GetMasterICD9Request) (*pb.GetMasterICD9Response, error) {
	limit := req.Limit
	if limit <= 0 {
		limit = 10
	}
	offset := req.Offset
	if offset < 0 {
		offset = 0
	}
	
	res, err := s.queries.GetICD9(ctx, db.GetICD9Params{
		Column1: req.Search,
		Column2: "",
		Limit:   limit,
		Offset:  offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get icd9: %v", err)
	}

	count, err := s.queries.CountICD9(ctx, db.CountICD9Params{
		Column1: req.Search,
		Column2: "",
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count icd9: %v", err)
	}

	var data []*pb.ICD9Item
	for _, i := range res {
		data = append(data, &pb.ICD9Item{
			Icd9Code:      i.Icd9Code,
			NameEn:        i.NameEn,
			NameId:        i.NameID.String,
			ChapterCode:   i.Category.String, // map category to ChapterCode for now
			BlockCode:     "",                // no block code in icd9
			IsActive:      i.IsActive.Bool,
			Polyclinics:   i.Polyclinics,
			SnomedCount:   i.SnomedCount,
			TindakanCount: i.TindakanCount,
		})
	}
	return &pb.GetMasterICD9Response{Items: data, Total: int32(count)}, nil
}

func (s *EMRGrpcServer) GetICD10SuggestionsForKBM(ctx context.Context, req *pb.GetICD10SuggestionsForKBMRequest) (*pb.GetICD10SuggestionsForKBMResponse, error) {
	res, err := s.queries.GetICD10SuggestionsForKBM(ctx, req.KbmCode)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get icd10 suggestions for kbm: %v", err)
	}

	polis, err := s.queries.GetPolyclinicsForKBM(ctx, req.KbmCode)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get polyclinics for kbm: %v", err)
	}

	var suggestions []*pb.ICD10Suggestion
	for _, i := range res {
		suggestions = append(suggestions, &pb.ICD10Suggestion{
			Icd10Code:         i.Icd10Code,
			Icd10Name:         i.NameID,
			IsPrimary:         i.IsPrimary.Bool,
			MappingConfidence: i.MappingConfidence.String,
		})
	}

	var polyclinics []*pb.Polyclinic
	for _, p := range polis {
		polyclinics = append(polyclinics, &pb.Polyclinic{
			Code: p.Code,
			Name: p.Name,
		})
	}

	return &pb.GetICD10SuggestionsForKBMResponse{
		Suggestions: suggestions,
		Polyclinics: polyclinics,
	}, nil
}

func (s *EMRGrpcServer) GetICD10MappingDetails(ctx context.Context, req *pb.GetICD10MappingDetailsRequest) (*pb.GetICD10MappingDetailsResponse, error) {
	kbmRes, err := s.queries.GetKBMSuggestionsForICD10(ctx, req.Icd10Code)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get kbm suggestions: %v", err)
	}

	snomedRes, err := s.queries.GetSNOMEDForICD10(ctx, req.Icd10Code)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get snomed for icd10: %v", err)
	}

	polis, err := s.queries.GetPolyclinicsForICD10(ctx, req.Icd10Code)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get polyclinics for icd10: %v", err)
	}

	var kbmMappings []*pb.KBMSuggestion
	for _, k := range kbmRes {
		kbmMappings = append(kbmMappings, &pb.KBMSuggestion{
			KbmCode:           k.KbmCode,
			KbmName:           k.KbmName,
			IsPrimary:         k.IsPrimary.Bool,
			MappingConfidence: k.MappingConfidence.String,
		})
	}

	var snomedMappings []*pb.SNOMEDItem
	for _, sItem := range snomedRes {
		snomedMappings = append(snomedMappings, &pb.SNOMEDItem{
			ConceptId:   sItem.ConceptID,
			Fsn:         sItem.Fsn,
			TermId:      sItem.TermID,
			SemanticTag: sItem.SemanticTag,
			IsActive:    sItem.IsActive,
		})
	}

	var polyclinics []*pb.Polyclinic
	for _, p := range polis {
		polyclinics = append(polyclinics, &pb.Polyclinic{
			Code: p.Code,
			Name: p.Name,
		})
	}

	return &pb.GetICD10MappingDetailsResponse{
		Icd10Code:      req.Icd10Code,
		KbmMappings:    kbmMappings,
		SnomedMappings: snomedMappings,
		Polyclinics:    polyclinics,
	}, nil
}

func (s *EMRGrpcServer) GetICD9MappingDetails(ctx context.Context, req *pb.GetICD9MappingDetailsRequest) (*pb.GetICD9MappingDetailsResponse, error) {
	snomedRes, err := s.queries.GetSNOMEDForICD9(ctx, req.Icd9Code)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get snomed for icd9: %v", err)
	}

	tindakanRes, err := s.queries.GetTindakanForICD9(ctx, req.Icd9Code)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get tindakan for icd9: %v", err)
	}

	polis, err := s.queries.GetPolyclinicsForICD9(ctx, req.Icd9Code)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get polyclinics for icd9: %v", err)
	}

	var snomedMappings []*pb.SNOMEDItem
	for _, sItem := range snomedRes {
		snomedMappings = append(snomedMappings, &pb.SNOMEDItem{
			ConceptId:   sItem.ConceptID,
			Fsn:         sItem.Fsn,
			TermId:      sItem.TermID,
			SemanticTag: sItem.SemanticTag,
			IsActive:    sItem.IsActive,
		})
	}

	var tindakanMappings []*pb.ICD9TindakanMapDetail
	for _, t := range tindakanRes {
		price, _ := strconv.ParseFloat(t.BasePrice, 64)
		tindakanMappings = append(tindakanMappings, &pb.ICD9TindakanMapDetail{
			KodeTindakan: t.KodeTindakan,
			NamaTindakan: t.NamaTindakan,
			BasePrice:    price,
			IsPrimary:    t.IsPrimary.Bool,
		})
	}

	var polyclinics []*pb.Polyclinic
	for _, p := range polis {
		polyclinics = append(polyclinics, &pb.Polyclinic{
			Code: p.Code,
			Name: p.Name,
		})
	}

	return &pb.GetICD9MappingDetailsResponse{
		Icd9Code:         req.Icd9Code,
		SnomedMappings:   snomedMappings,
		TindakanMappings: tindakanMappings,
		Polyclinics:      polyclinics,
	}, nil
}

func (s *EMRGrpcServer) GetICD9SuggestionsForTindakan(ctx context.Context, req *pb.GetICD9SuggestionsForTindakanRequest) (*pb.GetICD9SuggestionsForTindakanResponse, error) {
	res, err := s.queries.GetICD9SuggestionsForTindakan(ctx, req.KodeTindakan)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get icd9 suggestions: %v", err)
	}

	polis, err := s.queries.GetPolyclinicsForTindakan(ctx, req.KodeTindakan)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get polyclinics for tindakan: %v", err)
	}

	var suggestions []*pb.ICD9Suggestion
	for _, i := range res {
		suggestions = append(suggestions, &pb.ICD9Suggestion{
			Icd9Code:  i.Icd9Code,
			Icd9Name:  i.NameID.String,
			IsPrimary: i.IsPrimary.Bool,
		})
	}

	var polyclinics []*pb.Polyclinic
	for _, p := range polis {
		polyclinics = append(polyclinics, &pb.Polyclinic{
			Code: p.Code,
			Name: p.Name,
		})
	}

	return &pb.GetICD9SuggestionsForTindakanResponse{
		Suggestions: suggestions,
		Polyclinics: polyclinics,
	}, nil
}

func (s *EMRGrpcServer) FinalizeMedicalRecord(ctx context.Context, req *pb.FinalizeMedicalRecordRequest) (*pb.FinalizeMedicalRecordResponse, error) {
	errorsList, err := s.emrService.FinalizeMedicalRecord(ctx, req.EncounterNo, req.DoctorId)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to finalize medical record: %v", err)
	}

	success := len(errorsList) == 0
	
	// If success is true, we should also call CompleteEncounter to mark the status to completed if needed
	// But according to requirements, Finalize is its own thing. 
	// For now we just return the validation results.
	if success {
		// Attempt to complete the encounter
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

func (s *EMRGrpcServer) GetMasterSNOMED(ctx context.Context, req *pb.GetMasterSNOMEDRequest) (*pb.GetMasterSNOMEDResponse, error) {
	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	res, err := s.queries.GetSNOMEDConcepts(ctx, db.GetSNOMEDConceptsParams{
		Column1: req.Search,
		Column2: req.SemanticTag,
		Limit:   pageSize,
		Offset:  offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get snomed concepts: %v", err)
	}

	count, err := s.queries.CountSNOMEDConcepts(ctx, db.CountSNOMEDConceptsParams{
		Column1: req.Search,
		Column2: req.SemanticTag,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count snomed concepts: %v", err)
	}

	var data []*pb.SNOMEDItem
	for _, c := range res {
		data = append(data, &pb.SNOMEDItem{
			ConceptId:   c.ConceptID,
			Fsn:         c.Fsn,
			TermId:      c.TermID,
			SemanticTag: c.SemanticTag,
			IsActive:    c.IsActive,
			Icd10Count:  c.Icd10Count,
			Icd9Count:   c.Icd9Count,
		})
	}
	return &pb.GetMasterSNOMEDResponse{Data: data, TotalCount: int32(count)}, nil
}

func (s *EMRGrpcServer) GetSNOMEDMappingDetails(ctx context.Context, req *pb.GetSNOMEDMappingDetailsRequest) (*pb.GetSNOMEDMappingDetailsResponse, error) {
	icd10Res, err := s.queries.GetSNOMEDICD10Mappings(ctx, req.ConceptId)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get snomed icd10 mappings: %v", err)
	}

	icd9Res, err := s.queries.GetSNOMEDICD9Mappings(ctx, req.ConceptId)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get snomed icd9 mappings: %v", err)
	}

	var icd10Mappings []*pb.SNOMEDICD10MapDetail
	for _, m := range icd10Res {
		icd10Mappings = append(icd10Mappings, &pb.SNOMEDICD10MapDetail{
			Icd10Code:   m.Icd10Code,
			Icd10NameId: m.Icd10NameID,
			Icd10NameEn: m.Icd10NameEn,
			ChapterCode: m.ChapterCode.String,
			BlockCode:   m.BlockCode.String,
			MapGroup:    m.MapGroup,
			MapPriority: m.MapPriority,
			MapRule:     m.MapRule,
			MapAdvice:   m.MapAdvice,
			IsPrimary:   m.IsPrimary,
		})
	}

	var icd9Mappings []*pb.SNOMEDICD9MapDetail
	for _, m := range icd9Res {
		icd9Mappings = append(icd9Mappings, &pb.SNOMEDICD9MapDetail{
			Icd9Code:   m.Icd9Code,
			Icd9NameId: m.Icd9NameID.String,
			Icd9NameEn: m.Icd9NameEn,
			Category:   m.Category.String,
			IsPrimary:  m.IsPrimary,
		})
	}

	return &pb.GetSNOMEDMappingDetailsResponse{
		ConceptId:     req.ConceptId,
		Icd10Mappings: icd10Mappings,
		Icd9Mappings:  icd9Mappings,
	}, nil
}
