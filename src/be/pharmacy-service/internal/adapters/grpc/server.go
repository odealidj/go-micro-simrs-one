package grpc

import (
	"context"
	"database/sql"
	"strconv"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/adapters/db"
	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/core/ports"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/pharmacy/v1"
)

type PharmacyGrpcServer struct {
	pb.UnimplementedPharmacyServiceServer
	pharmacyService ports.PharmacyService
	queries         *db.Queries
}

func NewPharmacyGrpcServer(service ports.PharmacyService, queries *db.Queries) *PharmacyGrpcServer {
	return &PharmacyGrpcServer{
		pharmacyService: service,
		queries:         queries,
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

func (s *PharmacyGrpcServer) GetMasterObat(ctx context.Context, req *pb.GetMasterObatRequest) (*pb.GetMasterObatResponse, error) {
	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	res, err := s.queries.GetObat(ctx, db.GetObatParams{
		Column1: sql.NullString{String: req.SearchName, Valid: true},
		Column2: sql.NullString{String: req.SearchCode, Valid: true},
		Limit:   pageSize,
		Offset:  offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get obat: %v", err)
	}
	count, err := s.queries.CountObat(ctx, db.CountObatParams{
		Column1: sql.NullString{String: req.SearchName, Valid: true},
		Column2: sql.NullString{String: req.SearchCode, Valid: true},
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count obat: %v", err)
	}

	var data []*pb.MasterObat
	for _, i := range res {
		price, _ := strconv.ParseFloat(i.Price, 64)
		
		var polyclinics []string
		if len(i.Polyclinics) > 0 {
			polyclinics = i.Polyclinics
		}

		data = append(data, &pb.MasterObat{
			ItemCode:      i.ItemCode,
			Name:          i.Name,
			Price:         price,
			StockQuantity: i.StockQuantity,
			Polyclinics:   polyclinics,
			KfaCount:      i.KfaCount,
			DphoCount:     i.DphoCount,
			IsFornas:      i.IsFornas,
			IsPrb:         i.IsPrb,
			KfaCode:       i.KfaCode,
			BpjsDphoCode:  i.BpjsDphoCode,
			Restriction:   i.Restriction,
		})
	}
	return &pb.GetMasterObatResponse{Data: data, TotalCount: int32(count)}, nil
}

func (s *PharmacyGrpcServer) GetMasterObatByPoli(ctx context.Context, req *pb.GetMasterObatByPoliRequest) (*pb.GetMasterObatByPoliResponse, error) {
	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	res, err := s.queries.GetObatByPolyclinic(ctx, db.GetObatByPolyclinicParams{
		PolyclinicCode: req.PoliCode,
		Column2:        sql.NullString{String: req.SearchName, Valid: true},
		Column3:        sql.NullString{String: req.SearchCode, Valid: true},
		Limit:          pageSize,
		Offset:         offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get obat by poli: %v", err)
	}
	count, err := s.queries.CountObatByPolyclinic(ctx, db.CountObatByPolyclinicParams{
		PolyclinicCode: req.PoliCode,
		Column2:        sql.NullString{String: req.SearchName, Valid: true},
		Column3:        sql.NullString{String: req.SearchCode, Valid: true},
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count obat by poli: %v", err)
	}

	var data []*pb.MasterObat
	for _, i := range res {
		price, _ := strconv.ParseFloat(i.Price, 64)
		
		var polyclinics []string
		if len(i.Polyclinics) > 0 {
			polyclinics = i.Polyclinics
		}

		data = append(data, &pb.MasterObat{
			ItemCode:      i.ItemCode,
			Name:          i.Name,
			Price:         price,
			StockQuantity: i.StockQuantity,
			Polyclinics:   polyclinics,
			KfaCount:      i.KfaCount,
			DphoCount:     i.DphoCount,
			IsFornas:      i.IsFornas,
			IsPrb:         i.IsPrb,
			KfaCode:       i.KfaCode,
			BpjsDphoCode:  i.BpjsDphoCode,
			Restriction:   i.Restriction,
		})
	}
	return &pb.GetMasterObatByPoliResponse{Data: data, TotalCount: int32(count)}, nil
}

func (s *PharmacyGrpcServer) GetMasterKFA(ctx context.Context, req *pb.GetMasterKFARequest) (*pb.GetMasterKFAResponse, error) {
	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	res, err := s.queries.GetKFA(ctx, db.GetKFAParams{
		Column1: req.Search,
		Limit:   pageSize,
		Offset:  offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get KFA catalog: %v", err)
	}
	count, err := s.queries.CountKFA(ctx, req.Search)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count KFA catalog: %v", err)
	}

	var data []*pb.MasterKFAItem
	for _, k := range res {
		data = append(data, &pb.MasterKFAItem{
			KfaCode:         k.KfaCode,
			Name:            k.Name,
			ActiveSubstance: k.ActiveSubstance.String,
			DosageForm:      k.DosageForm.String,
			Strength:        k.Strength.String,
			BpomNie:         k.BpomNie.String,
			AtcCode:         k.AtcCode.String,
			SnomedConceptId: k.SnomedConceptID.String,
			IsActive:        k.IsActive,
			MappedItemCount: k.MappedItemCount,
		})
	}
	return &pb.GetMasterKFAResponse{Data: data, TotalCount: int32(count)}, nil
}

func (s *PharmacyGrpcServer) GetMasterDPHO(ctx context.Context, req *pb.GetMasterDPHORequest) (*pb.GetMasterDPHOResponse, error) {
	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	var isFornas sql.NullBool
	if req.IsFornas != nil {
		isFornas = sql.NullBool{Bool: *req.IsFornas, Valid: true}
	}
	var isPrb sql.NullBool
	if req.IsPrb != nil {
		isPrb = sql.NullBool{Bool: *req.IsPrb, Valid: true}
	}

	res, err := s.queries.GetDPHO(ctx, db.GetDPHOParams{
		Column1:  req.Search,
		Limit:    pageSize,
		Offset:   offset,
		IsFornas: isFornas,
		IsPrb:    isPrb,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get DPHO catalog: %v", err)
	}
	count, err := s.queries.CountDPHO(ctx, db.CountDPHOParams{
		Column1:  req.Search,
		IsFornas: isFornas,
		IsPrb:    isPrb,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count DPHO catalog: %v", err)
	}

	var data []*pb.MasterDPHOItem
	for _, d := range res {
		data = append(data, &pb.MasterDPHOItem{
			DphoCode:        d.DphoCode,
			DphoName:        d.DphoName,
			IsFornas:        d.IsFornas,
			IsPrb:           d.IsPrb,
			Restriction:     d.Restriction.String,
			MaxQtyPerClaim:  d.MaxQtyPerClaim,
			IsActive:        d.IsActive,
			MappedItemCount: d.MappedItemCount,
		})
	}
	return &pb.GetMasterDPHOResponse{Data: data, TotalCount: int32(count)}, nil
}

func (s *PharmacyGrpcServer) GetObatMappingDetails(ctx context.Context, req *pb.GetObatMappingDetailsRequest) (*pb.GetObatMappingDetailsResponse, error) {
	kfaRows, err := s.queries.GetKFAMappingsForObat(ctx, req.ItemCode)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get KFA mappings: %v", err)
	}
	dphoRows, err := s.queries.GetDPHOMappingsForObat(ctx, req.ItemCode)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get DPHO mappings: %v", err)
	}
	polys, err := s.queries.GetPolyclinicsForObat(ctx, req.ItemCode)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get polyclinics: %v", err)
	}

	var kfaMappings []*pb.ObatKFAMapDetail
	for _, k := range kfaRows {
		kfaMappings = append(kfaMappings, &pb.ObatKFAMapDetail{
			KfaCode:           k.KfaCode,
			Name:              k.Name,
			ActiveSubstance:   k.ActiveSubstance.String,
			DosageForm:        k.DosageForm.String,
			Strength:          k.Strength.String,
			BpomNie:           k.BpomNie.String,
			AtcCode:           k.AtcCode.String,
			SnomedConceptId:   k.SnomedConceptID.String,
			IsPrimary:         k.IsPrimary,
			MappingConfidence: k.MappingConfidence,
		})
	}

	var dphoMappings []*pb.ObatDPHOMapDetail
	for _, d := range dphoRows {
		dphoMappings = append(dphoMappings, &pb.ObatDPHOMapDetail{
			DphoCode:       d.DphoCode,
			DphoName:       d.DphoName,
			IsFornas:       d.IsFornas,
			IsPrb:          d.IsPrb,
			Restriction:    d.Restriction.String,
			MaxQtyPerClaim: d.MaxQtyPerClaim,
		})
	}

	return &pb.GetObatMappingDetailsResponse{
		ItemCode:     req.ItemCode,
		KfaMappings:  kfaMappings,
		DphoMappings: dphoMappings,
		Polyclinics:  polys,
	}, nil
}

