package grpc

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/core/ports"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/pharmacy/v1"
)

type PharmacyGrpcServer struct {
	pb.UnimplementedPharmacyServiceServer
	pharmacyService ports.PharmacyService
}

func NewPharmacyGrpcServer(service ports.PharmacyService) *PharmacyGrpcServer {
	return &PharmacyGrpcServer{
		pharmacyService: service,
	}
}

func (s *PharmacyGrpcServer) CreatePrescription(ctx context.Context, req *pb.CreatePrescriptionRequest) (*pb.CreatePrescriptionResponse, error) {
	var domainItems []domain.PrescriptionItem
	for _, it := range req.Items {
		domainItems = append(domainItems, domain.PrescriptionItem{
			ItemCode: it.ItemCode,
			Quantity: it.Quantity,
		})
	}

	prescriptionID, err := s.pharmacyService.CreatePrescription(ctx, req.EncounterNo, req.IsCompounded, req.Notes, req.Diagnosis, req.Gender, req.AgeBracket, req.DoctorId, req.DepartmentCode, domainItems)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create prescription: %v", err)
	}

	return &pb.CreatePrescriptionResponse{
		Success:        true,
		PrescriptionId: prescriptionID,
		Message:        "Prescription created successfully",
	}, nil
}

func (s *PharmacyGrpcServer) DispensePrescription(ctx context.Context, req *pb.DispensePrescriptionRequest) (*pb.DispensePrescriptionResponse, error) {
	err := s.pharmacyService.DispensePrescription(ctx, req.PrescriptionId)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to dispense prescription: %v", err)
	}

	return &pb.DispensePrescriptionResponse{
		Success: true,
		Message: "Prescription dispensed successfully",
	}, nil
}

func (s *PharmacyGrpcServer) RollbackPrescription(ctx context.Context, req *pb.RollbackPrescriptionRequest) (*pb.RollbackPrescriptionResponse, error) {
	err := s.pharmacyService.RollbackPrescription(ctx, req.PrescriptionId)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to rollback prescription: %v", err)
	}

	return &pb.RollbackPrescriptionResponse{
		Success: true,
		Message: "Prescription rolled back successfully",
	}, nil
}

func (s *PharmacyGrpcServer) GetEstimatedWaitTime(ctx context.Context, req *pb.GetEstimatedWaitTimeRequest) (*pb.GetEstimatedWaitTimeResponse, error) {
	est, err := s.pharmacyService.EstimateWaitTime(ctx, req.DoctorId, req.DepartmentCode, req.Gender, req.AgeBracket, req.IsCompounded)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to estimate wait time: %v", err)
	}
	return &pb.GetEstimatedWaitTimeResponse{
		EstimatedMinutes: est,
	}, nil
}
