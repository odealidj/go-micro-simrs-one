package grpc

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/aliube/go-micro-simrs-one/registration-service/internal/core/ports"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/registration/v1"
)

type RegistrationGrpcServer struct {
	pb.UnimplementedRegistrationServiceServer
	registrationService ports.RegistrationService
}

func NewRegistrationGrpcServer(service ports.RegistrationService) *RegistrationGrpcServer {
	return &RegistrationGrpcServer{
		registrationService: service,
	}
}

func (s *RegistrationGrpcServer) RegisterEncounter(ctx context.Context, req *pb.RegisterEncounterRequest) (*pb.RegisterEncounterResponse, error) {
	encounterNo, err := s.registrationService.RegisterEncounter(ctx, req.Mrn, req.DepartmentCode, req.DoctorId)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to register encounter: %v", err)
	}

	return &pb.RegisterEncounterResponse{
		Success:     true,
		EncounterNo: encounterNo,
		Message:     "Encounter registered successfully",
	}, nil
}
