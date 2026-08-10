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

func (s *BillingGrpcServer) GenerateInvoice(ctx context.Context, req *pb.GenerateInvoiceRequest) (*pb.GenerateInvoiceResponse, error) {
	invoice, err := s.billingService.GenerateInvoice(ctx, req.EncounterNo)
	if err != nil {
		return &pb.GenerateInvoiceResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}

	var items []*pb.InvoiceItem
	for _, it := range invoice.Items {
		items = append(items, &pb.InvoiceItem{
			ItemType:    it.ItemType,
			Description: it.Description,
			Amount:      it.Amount,
		})
	}

	return &pb.GenerateInvoiceResponse{
		Success:     true,
		InvoiceId:   invoice.ID,
		TotalAmount: invoice.TotalAmount,
		Items:       items,
		Message:     "Invoice generated successfully",
	}, nil
}

func (s *BillingGrpcServer) PayInvoice(ctx context.Context, req *pb.PayInvoiceRequest) (*pb.PayInvoiceResponse, error) {
	err := s.billingService.PayInvoice(ctx, req.InvoiceId, req.AmountPaid)
	if err != nil {
		return &pb.PayInvoiceResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}

	return &pb.PayInvoiceResponse{
		Success: true,
		Message: "Invoice paid successfully",
	}, nil
}
