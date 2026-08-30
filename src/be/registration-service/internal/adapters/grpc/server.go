package grpc

import (
	"context"
	"strings"
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
	encounterNo, err := s.registrationService.RegisterEncounter(ctx, req.Mrn, req.DepartmentCode, req.DoctorId, req.PerawatId, req.Guarantor)
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
	startDate := time.Now()
	endDate := time.Now()
	if req.Date != "" {
		loc := time.Now().Location()
		if strings.Contains(req.Date, ":") {
			parts := strings.Split(req.Date, ":")
			if p1, err := time.ParseInLocation("2006-01-02", parts[0], loc); err == nil {
				startDate = p1
			}
			if p2, err := time.ParseInLocation("2006-01-02", parts[1], loc); err == nil {
				endDate = p2
			}
		} else if parsedDate, err := time.ParseInLocation("2006-01-02", req.Date, loc); err == nil {
			startDate = parsedDate
			endDate = parsedDate
		}
	}

	encounters, err := s.registrationService.GetTodayEncounters(ctx, startDate, endDate)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get today encounters: %v", err)
	}

	var pbEncounters []*pb.EncounterDetail
	for _, enc := range encounters {
		isNewStr := "false"
		if enc.IsNewPatient {
			isNewStr = "true"
		}
		pbEncounters = append(pbEncounters, &pb.EncounterDetail{
			EncounterNo:    enc.EncounterNo,
			Mrn:            enc.MRN,
			DepartmentCode: enc.Department,
			DoctorId:       enc.DoctorID,
			PerawatId:      enc.PerawatID,
			Status:         enc.Status,
			RegisteredTime: enc.CreatedAt.Format("2006-01-02T15:04:05Z") + "|" + isNewStr,
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

func (s *RegistrationGrpcServer) UpdateEncounterGuarantor(ctx context.Context, req *pb.UpdateEncounterGuarantorRequest) (*pb.UpdateEncounterGuarantorResponse, error) {
	if req.EncounterNo == "" || req.Guarantor == "" {
		return nil, status.Errorf(codes.InvalidArgument, "EncounterNo and Guarantor are required")
	}

	err := s.registrationService.UpdateEncounterGuarantor(ctx, req.EncounterNo, req.Guarantor)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "Failed to update guarantor: %v", err)
	}

	return &pb.UpdateEncounterGuarantorResponse{
		Success: true,
		Message: "Guarantor updated successfully",
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

func (s *RegistrationGrpcServer) GetDashboardMetrics(ctx context.Context, req *pb.GetDashboardMetricsRequest) (*pb.GetDashboardMetricsResponse, error) {
	newPatients, oldPatients, waitTimes, weeklyVisits, err := s.registrationService.GetDashboardMetrics(ctx, time.Now())
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get dashboard metrics: %v", err)
	}

	var pbWaitTimes []*pb.WaitTimeMetric
	for k, v := range waitTimes {
		pbWaitTimes = append(pbWaitTimes, &pb.WaitTimeMetric{
			PoliCode:               k,
			AverageWaitTimeMinutes: v,
		})
	}

	var pbWeeklyVisits []*pb.WeeklyVisitMetric
	for k, v := range weeklyVisits {
		pbWeeklyVisits = append(pbWeeklyVisits, &pb.WeeklyVisitMetric{
			Date:        k,
			TotalVisits: v,
		})
	}

	return &pb.GetDashboardMetricsResponse{
		NewPatients:  newPatients,
		OldPatients:  oldPatients,
		WaitTimes:    pbWaitTimes,
		WeeklyVisits: pbWeeklyVisits,
	}, nil
}

