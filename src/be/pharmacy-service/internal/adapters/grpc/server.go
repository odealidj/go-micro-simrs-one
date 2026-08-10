package grpc

import (
	"context"

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

	prescriptionID, err := s.pharmacyService.CreatePrescription(ctx, req.EncounterNo, req.IsCompounded, req.Notes, domainItems)
	if err != nil {
		return &pb.CreatePrescriptionResponse{
			Success: false,
			Message: err.Error(),
		}, nil
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
		return &pb.DispensePrescriptionResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}

	return &pb.DispensePrescriptionResponse{
		Success: true,
		Message: "Prescription dispensed successfully",
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
