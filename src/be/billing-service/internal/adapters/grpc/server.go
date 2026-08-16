package grpc

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/aliube/go-micro-simrs-one/billing-service/internal/core/ports"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/billing/v1"
)

type BillingGrpcServer struct {
	pb.UnimplementedBillingServiceServer
	billingService ports.BillingService
}

func NewBillingGrpcServer(service ports.BillingService) *BillingGrpcServer {
	return &BillingGrpcServer{billingService: service}
}

func (s *BillingGrpcServer) GenerateInvoice(ctx context.Context, req *pb.GenerateInvoiceRequest) (*pb.GenerateInvoiceResponse, error) {
	if req.EncounterNo == "" {
		return nil, status.Error(codes.InvalidArgument, "encounter_no is required")
	}
	invoice, err := s.billingService.GenerateInvoice(ctx, req.EncounterNo)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to generate invoice: %v", err)
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
	if req.InvoiceId == "" {
		return nil, status.Error(codes.InvalidArgument, "invoice_id is required")
	}
	if req.AmountPaid <= 0 {
		return nil, status.Error(codes.InvalidArgument, "amount_paid must be greater than zero")
	}
	encounterNo, err := s.billingService.PayInvoice(ctx, req.InvoiceId, req.AmountPaid)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to pay invoice: %v", err)
	}
	return &pb.PayInvoiceResponse{Success: true, Message: "Invoice paid successfully", EncounterNo: encounterNo}, nil
}

func (s *BillingGrpcServer) AddRegistrationFee(ctx context.Context, req *pb.AddRegistrationFeeRequest) (*pb.AddRegistrationFeeResponse, error) {
	if req.EncounterNo == "" {
		return nil, status.Error(codes.InvalidArgument, "encounter_no is required")
	}
	if req.DepartmentCode == "" {
		return nil, status.Error(codes.InvalidArgument, "department_code is required")
	}
	if req.Amount <= 0 {
		return nil, status.Error(codes.InvalidArgument, "amount must be greater than zero")
	}

	invoiceID, err := s.billingService.AddRegistrationFee(ctx, req.EncounterNo, req.DepartmentCode, req.Amount)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to add registration fee: %v", err)
	}

	return &pb.AddRegistrationFeeResponse{
		Success:   true,
		InvoiceId: invoiceID,
		Message:   "Registration fee added successfully",
	}, nil
}
