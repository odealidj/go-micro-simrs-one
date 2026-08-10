package grpc

import (
	"context"

	"github.com/aliube/go-micro-simrs-one/billing-service/internal/core/ports"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/billing/v1"
)

type BillingGrpcServer struct {
	pb.UnimplementedBillingServiceServer
	billingService ports.BillingService
}

func NewBillingGrpcServer(service ports.BillingService) *BillingGrpcServer {
	return &BillingGrpcServer{
		billingService: service,
	}
}

func (s *BillingGrpcServer) CreateInvoice(ctx context.Context, req *pb.CreateInvoiceRequest) (*pb.CreateInvoiceResponse, error) {
	invoice, err := s.billingService.CreateInvoice(ctx, req.EncounterNo, req.RelatedId, req.Amount)
	if err != nil {
		return &pb.CreateInvoiceResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}

	return &pb.CreateInvoiceResponse{
		Success:   true,
		InvoiceId: invoice.ID,
		Message:   "Invoice created successfully",
	}, nil
}
