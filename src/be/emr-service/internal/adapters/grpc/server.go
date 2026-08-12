package grpc

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/aliube/go-micro-simrs-one/emr-service/internal/core/ports"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/emr/v1"
)

type EMRGrpcServer struct {
	pb.UnimplementedEMRServiceServer
	emrService ports.EMRService
}

func NewEMRGrpcServer(service ports.EMRService) *EMRGrpcServer {
	return &EMRGrpcServer{
		emrService: service,
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

func (s *EMRGrpcServer) GetICD10SuggestionsForKBM(ctx context.Context, req *pb.GetICD10SuggestionsForKBMRequest) (*pb.GetICD10SuggestionsForKBMResponse, error) {
	suggestions, err := s.emrService.GetICD10SuggestionsForKBM(ctx, req.KbmCode)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get icd10 suggestions: %v", err)
	}
	var pbSuggestions []*pb.ICD10Suggestion
	for _, s := range suggestions {
		pbSuggestions = append(pbSuggestions, &pb.ICD10Suggestion{
			Icd10Code: s.ICD10Code,
			IsPrimary: s.IsPrimary,
		})
	}
	return &pb.GetICD10SuggestionsForKBMResponse{
		Suggestions: pbSuggestions,
	}, nil
}

func (s *EMRGrpcServer) AddDiagnosisKBM(ctx context.Context, req *pb.AddDiagnosisKBMRequest) (*pb.AddDiagnosisKBMResponse, error) {
	err := s.emrService.AddDiagnosisKBM(ctx, req.EncounterNo, req.KbmCode, req.Notes, req.DoctorId, req.DepartmentCode, req.Gender, req.AgeBracket)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to add kbm diagnosis: %v", err)
	}

	return &pb.AddDiagnosisKBMResponse{
		Success: true,
		Message: "Diagnosis added successfully",
	}, nil
}

func (s *EMRGrpcServer) VerifyICD10Mapping(ctx context.Context, req *pb.VerifyICD10MappingRequest) (*pb.VerifyICD10MappingResponse, error) {
	err := s.emrService.VerifyICD10Mapping(ctx, req.EncounterNo, req.Icd10Codes, req.Notes)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to verify icd10 mapping: %v", err)
	}
	return &pb.VerifyICD10MappingResponse{
		Success: true,
		Message: "ICD-10 mapping verified",
	}, nil
}

func (s *EMRGrpcServer) ListPendingICD10Verifications(ctx context.Context, req *pb.ListPendingICD10VerificationsRequest) (*pb.ListPendingICD10VerificationsResponse, error) {
	limit := req.Limit
	if limit == 0 {
		limit = 20
	}
	items, total, err := s.emrService.ListPendingICD10Verifications(ctx, limit, req.Offset)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list pending verifications: %v", err)
	}

	var pbItems []*pb.PendingVerificationItem
	for _, i := range items {
		pbItems = append(pbItems, &pb.PendingVerificationItem{
			EncounterNo:        i.EncounterNo,
			Mrn:                i.MRN,
			KbmCode:            i.KBMCode,
			KbmName:            i.KBMName,
			Icd10MappingStatus: i.ICD10MappingStatus,
			CreatedAt:          i.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}
	return &pb.ListPendingICD10VerificationsResponse{
		Items: pbItems,
		Total: total,
	}, nil
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

	return &pb.GetMedicalRecordResponse{
		EncounterNo:        mr.EncounterNo,
		PatientMrn:         mr.MRN,
		Icd10Codes:         mr.ICD10Codes,
		KbmCode:            mr.KBMCode,
		KbmName:            mr.KBMName,
		Icd10MappingStatus: mr.ICD10MappingStatus,
		Notes:              mr.Notes,
		Triage:             triage,
		Actions:            actions,
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
