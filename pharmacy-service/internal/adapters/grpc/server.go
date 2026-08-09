package grpc

import (
	"context"

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

func (s *PharmacyGrpcServer) Prescribe(ctx context.Context, req *pb.PrescribeRequest) (*pb.PrescribeResponse, error) {
	prescription, err := s.pharmacyService.Prescribe(ctx, req.EncounterNo, req.ItemCode, req.Quantity)
	if err != nil {
		return &pb.PrescribeResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}

	return &pb.PrescribeResponse{
		Success:        true,
		PrescriptionId: prescription.ID,
		AmountToBill:   prescription.Amount,
		Message:        "Prescription reserved successfully",
	}, nil
}

func (s *PharmacyGrpcServer) RollbackPrescription(ctx context.Context, req *pb.RollbackPrescriptionRequest) (*pb.RollbackPrescriptionResponse, error) {
	err := s.pharmacyService.RollbackPrescription(ctx, req.PrescriptionId)
	if err != nil {
		return &pb.RollbackPrescriptionResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}

	return &pb.RollbackPrescriptionResponse{
		Success: true,
		Message: "Prescription rollbacked successfully",
	}, nil
}
