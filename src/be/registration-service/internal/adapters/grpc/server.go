package grpc

import (
	"context"
	"time"

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
	encounterNo, err := s.registrationService.RegisterEncounter(ctx, req.Mrn, req.DepartmentCode, req.DoctorId, req.Guarantor)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to register encounter: %v", err)
	}

	return &pb.RegisterEncounterResponse{
		Success:     true,
		EncounterNo: encounterNo,
		Message:     "Encounter registered successfully",
	}, nil
}

func (s *RegistrationGrpcServer) GetTodayEncounters(ctx context.Context, req *pb.GetTodayEncountersRequest) (*pb.GetTodayEncountersResponse, error) {
	targetDate := time.Now()
	if req.Date != "" {
		parsedDate, err := time.Parse("2006-01-02", req.Date)
		if err == nil {
			targetDate = parsedDate
		}
	}

	encounters, err := s.registrationService.GetTodayEncounters(ctx, targetDate)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get today encounters: %v", err)
	}

	var pbEncounters []*pb.EncounterDetail
	for _, enc := range encounters {
		pbEncounters = append(pbEncounters, &pb.EncounterDetail{
			EncounterNo:    enc.EncounterNo,
			Mrn:            enc.MRN,
			DepartmentCode: enc.Department,
			DoctorId:       enc.DoctorID,
			Status:         enc.Status,
			RegisteredTime: enc.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	return &pb.GetTodayEncountersResponse{
		Encounters: pbEncounters,
		TotalCount: int32(len(pbEncounters)),
	}, nil
}

func (s *RegistrationGrpcServer) CancelEncounter(ctx context.Context, req *pb.CancelEncounterRequest) (*pb.CancelEncounterResponse, error) {
	if req.EncounterNo == "" {
		return nil, status.Error(codes.InvalidArgument, "encounter_no is required")
	}

	err := s.registrationService.CancelEncounter(ctx, req.EncounterNo, req.Reason)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to cancel encounter: %v", err)
	}

	return &pb.CancelEncounterResponse{
		Success: true,
		Message: "Encounter cancelled successfully",
	}, nil
}

func (s *RegistrationGrpcServer) UpdateEncounterStatus(ctx context.Context, req *pb.UpdateEncounterStatusRequest) (*pb.UpdateEncounterStatusResponse, error) {
	if req.EncounterNo == "" {
		return nil, status.Error(codes.InvalidArgument, "encounter_no is required")
	}
	if req.Status == "" {
		return nil, status.Error(codes.InvalidArgument, "status is required")
	}

	err := s.registrationService.UpdateEncounterStatus(ctx, req.EncounterNo, req.Status)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update encounter status: %v", err)
	}

	return &pb.UpdateEncounterStatusResponse{
		Success: true,
		Message: "Encounter status updated successfully",
	}, nil
}
