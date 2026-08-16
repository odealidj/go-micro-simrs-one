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
	mrn, err := s.patientService.RegisterPatient(ctx, req.Name, req.Nik, req.Dob, req.Gender, req.BirthPlace, req.Address, req.PhotoUrl, req.Email, req.UserId)
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
		Patient: &pb.Patient{
			Mrn:        patient.MRN,
			Name:       patient.Name,
			Nik:        patient.NIK,
			Dob:        patient.DOB,
			Gender:     patient.Gender,
			BirthPlace: patient.BirthPlace,
			Address:    patient.Address,
			PhotoUrl:   patient.PhotoURL,
			Email:      patient.Email,
			UserId:     patient.UserID,
		},
	}, nil
}

func (s *PatientGrpcServer) SearchPatients(ctx context.Context, req *pb.SearchPatientsRequest) (*pb.SearchPatientsResponse, error) {
	patients, totalCount, err := s.patientService.SearchPatients(ctx, int(req.Page), int(req.PageSize), req.Search)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to search patients: %v", err)
	}

	var pbPatients []*pb.Patient
	for _, p := range patients {
		pbPatients = append(pbPatients, &pb.Patient{
			Mrn:        p.MRN,
			Name:       p.Name,
			Nik:        p.NIK,
			Dob:        p.DOB,
			Gender:     p.Gender,
			BirthPlace: p.BirthPlace,
			Address:    p.Address,
			PhotoUrl:   p.PhotoURL,
			Email:      p.Email,
			UserId:     p.UserID,
		})
	}

	return &pb.SearchPatientsResponse{
		Patients:   pbPatients,
		TotalCount: int32(totalCount),
	}, nil
}

func (s *PatientGrpcServer) DeletePatient(ctx context.Context, req *pb.DeletePatientRequest) (*pb.DeletePatientResponse, error) {
	if req.Mrn == "" {
		return nil, status.Error(codes.InvalidArgument, "mrn is required")
	}

	err := s.patientService.DeletePatient(ctx, req.Mrn)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete patient: %v", err)
	}

	return &pb.DeletePatientResponse{
		Success: true,
		Message: "Patient deleted successfully",
	}, nil
}
