package grpc

import (
	"context"

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

func (s *EMRGrpcServer) SubmitTriage(ctx context.Context, req *pb.SubmitTriageRequest) (*pb.SubmitTriageResponse, error) {
	err := s.emrService.SubmitTriage(ctx, req.EncounterNo, &req.BloodPressureSystolic, &req.BloodPressureDiastolic, &req.Temperature, &req.HeartRate, req.Notes)
	if err != nil {
		return &pb.SubmitTriageResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}

	return &pb.SubmitTriageResponse{
		Success: true,
		Message: "Triage submitted successfully",
	}, nil
}

func (s *EMRGrpcServer) AddDiagnosis(ctx context.Context, req *pb.AddDiagnosisRequest) (*pb.AddDiagnosisResponse, error) {
	err := s.emrService.AddDiagnosis(ctx, req.EncounterNo, req.Icd10Code, req.Notes)
	if err != nil {
		return &pb.AddDiagnosisResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}

	return &pb.AddDiagnosisResponse{
		Success: true,
		Message: "Diagnosis added successfully",
	}, nil
}

func (s *EMRGrpcServer) AddMedicalAction(ctx context.Context, req *pb.AddMedicalActionRequest) (*pb.AddMedicalActionResponse, error) {
	err := s.emrService.AddMedicalAction(ctx, req.EncounterNo, req.ActionCode, req.ActionName, req.Price, req.Notes)
	if err != nil {
		return &pb.AddMedicalActionResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}

	return &pb.AddMedicalActionResponse{
		Success: true,
		Message: "Medical action added successfully",
	}, nil
}

func (s *EMRGrpcServer) GetMedicalRecord(ctx context.Context, req *pb.GetMedicalRecordRequest) (*pb.GetMedicalRecordResponse, error) {
	mr, err := s.emrService.GetMedicalRecord(ctx, req.EncounterNo)
	if err != nil {
		return nil, err
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
		EncounterNo: mr.EncounterNo,
		PatientMrn:  mr.MRN,
		Icd10Codes:  mr.ICD10Codes,
		Notes:       mr.Notes,
		Triage:      triage,
		Actions:     actions,
	}, nil
}
