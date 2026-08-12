package grpc

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/aliube/go-micro-simrs-one/patient-service/internal/core/ports"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/patient/v1"
)

type PatientGrpcServer struct {
	pb.UnimplementedPatientServiceServer
	patientService ports.PatientService
}

func NewPatientGrpcServer(service ports.PatientService) *PatientGrpcServer {
	return &PatientGrpcServer{
		patientService: service,
	}
}

func (s *PatientGrpcServer) RegisterPatient(ctx context.Context, req *pb.RegisterPatientRequest) (*pb.RegisterPatientResponse, error) {
	mrn, err := s.patientService.RegisterPatient(ctx, req.Name, req.Nik, req.Dob, req.UserId)
	if err != nil {
		if err.Error() == "patient already exists" {
			return nil, status.Errorf(codes.AlreadyExists, "Registration failed: invalid data")
		}
		return nil, status.Errorf(codes.Internal, "failed to register patient: %v", err)
	}

	return &pb.RegisterPatientResponse{
		Success: true,
		Mrn:     mrn,
		Message: "Patient registered successfully",
	}, nil
}

func (s *PatientGrpcServer) GetPatientByMRN(ctx context.Context, req *pb.GetPatientByMRNRequest) (*pb.GetPatientByMRNResponse, error) {
	patient, err := s.patientService.GetPatientByMRN(ctx, req.Mrn)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "patient not found: %v", err)
	}

	return &pb.GetPatientByMRNResponse{
		Mrn:  patient.MRN,
		Name: patient.Name,
		Nik:  patient.NIK,
		Dob:  patient.DOB,
	}, nil
}
