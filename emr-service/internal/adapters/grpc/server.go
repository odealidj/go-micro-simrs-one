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

func (s *EMRGrpcServer) GetMedicalRecord(ctx context.Context, req *pb.GetMedicalRecordRequest) (*pb.GetMedicalRecordResponse, error) {
	mr, err := s.emrService.GetMedicalRecord(ctx, req.EncounterNo)
	if err != nil {
		return nil, err
	}

	return &pb.GetMedicalRecordResponse{
		EncounterNo: mr.EncounterNo,
		PatientMrn:  mr.MRN,
		Icd10Codes:  mr.ICD10Codes,
		Notes:       mr.Notes,
	}, nil
}
