package grpc

import (
	"context"
	"time"

	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/aliube/go-micro-simrs-one/auth-service/internal/adapters/db"
	"github.com/aliube/go-micro-simrs-one/auth-service/internal/core/ports"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/auth/v1"
)

type AuthGrpcServer struct {
	pb.UnimplementedAuthServiceServer
	authService ports.AuthService
	queries     *db.Queries
}

func NewAuthGrpcServer(service ports.AuthService, queries *db.Queries) *AuthGrpcServer {
	return &AuthGrpcServer{
		authService: service,
		queries:     queries,
	}
}

func (s *AuthGrpcServer) Login(ctx context.Context, req *pb.LoginRequest) (*pb.LoginResponse, error) {
	if req.Username == "" || req.Password == "" {
		return nil, status.Error(codes.InvalidArgument, "username and password are required")
	}

	tokenPair, role, userID, poliCode, err := s.authService.Login(ctx, req.Username, req.Password)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "%v", err)
	}

	return &pb.LoginResponse{
		Success: true,
		AccessToken: tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		AccessTokenExpiresAt: tokenPair.AccessTokenExpiresAt.Format(time.RFC3339),
		RefreshTokenExpiresAt: tokenPair.RefreshTokenExpiresAt.Format(time.RFC3339),
		Role:    role,
		UserId:  userID,
		PoliCode: poliCode,
	}, nil
}

func (s *AuthGrpcServer) RefreshToken(ctx context.Context, req *pb.RefreshTokenRequest) (*pb.RefreshTokenResponse, error) {
	if req.RefreshToken == "" {
		return nil, status.Error(codes.InvalidArgument, "refresh token is required")
	}
	tokenPair, err := s.authService.RefreshToken(ctx, req.RefreshToken)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "%v", err)
	}
	return &pb.RefreshTokenResponse{
		Success: true,
		AccessToken: tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		AccessTokenExpiresAt: tokenPair.AccessTokenExpiresAt.Format(time.RFC3339),
		RefreshTokenExpiresAt: tokenPair.RefreshTokenExpiresAt.Format(time.RFC3339),
	}, nil
}

func (s *AuthGrpcServer) Signup(ctx context.Context, req *pb.SignupRequest) (*pb.SignupResponse, error) {
	if req.Username == "" || req.Password == "" {
		return nil, status.Error(codes.InvalidArgument, "username and password are required")
	}

	userID, err := s.authService.Signup(ctx, req.Username, req.Password, req.Email, req.Phone, req.FullName, req.Nip, req.LabelProfesiId)
	if err != nil {
		if err.Error() == "Username already registered" {
			return nil, status.Error(codes.AlreadyExists, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &pb.SignupResponse{
		Success: true,
		UserId:  userID,
		Message: "Staff registered successfully. Please wait for admin approval.",
	}, nil
}

func (s *AuthGrpcServer) RegisterPatientUser(ctx context.Context, req *pb.RegisterPatientUserRequest) (*pb.RegisterPatientUserResponse, error) {
	if req.Username == "" || req.Password == "" {
		return nil, status.Error(codes.InvalidArgument, "username and password are required")
	}

	userID, err := s.authService.RegisterPatientUser(ctx, req.Username, req.Password)
	if err != nil {
		if err.Error() == "patient username already registered" {
			return nil, status.Error(codes.AlreadyExists, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &pb.RegisterPatientUserResponse{
		Success: true,
		UserId:  userID,
	}, nil
}

func (s *AuthGrpcServer) ValidateToken(ctx context.Context, req *pb.ValidateTokenRequest) (*pb.ValidateTokenResponse, error) {
	if req.Token == "" {
		return nil, status.Error(codes.InvalidArgument, "token is required")
	}
	isValid, role, userID, err := s.authService.ValidateToken(ctx, req.Token)
	if err != nil || !isValid {
		return nil, status.Errorf(codes.Unauthenticated, "invalid token: %v", err)
	}
	return &pb.ValidateTokenResponse{Valid: true, UserId: userID, Role: role}, nil
}

func (s *AuthGrpcServer) ExtractKTPData(ctx context.Context, req *pb.ExtractKTPDataRequest) (*pb.ExtractKTPDataResponse, error) {
	if req.Base64Image == "" {
		return nil, status.Error(codes.InvalidArgument, "base64_image is required")
	}

	result, err := s.authService.ExtractKTPData(ctx, req.Base64Image)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to extract KTP data: %v", err)
	}

	return &pb.ExtractKTPDataResponse{
		Success: true,
		Nik:     result.NIK,
		Name:    result.Name,
		Dob:     result.DOB,
	}, nil
}

func (s *AuthGrpcServer) ListUsers(ctx context.Context, req *pb.ListUsersRequest) (*pb.ListUsersResponse, error) {
	users, totalCount, err := s.authService.ListUsers(ctx, int(req.Page), int(req.PageSize), req.StatusFilter, req.Search)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list users: %v", err)
	}

	var pbUsers []*pb.UserData
	for _, u := range users {
		pbUser := &pb.UserData{
			Id:        u.ID,
			Username:  u.Username,
			Role:      "",
			Status:    u.Status,
			CreatedAt: u.CreatedAt.Format(time.RFC3339),
		}
		if u.Role != nil {
			pbUser.Role = *u.Role
		}
		if u.StaffProfile != nil {
			pbUser.Nip = u.StaffProfile.NIP
			pbUser.Email = u.StaffProfile.Email
			pbUser.Phone = u.StaffProfile.Phone
		}
		pbUsers = append(pbUsers, pbUser)
	}

	return &pb.ListUsersResponse{
		Users:      pbUsers,
		TotalCount: int32(totalCount),
	}, nil
}

func (s *AuthGrpcServer) UpdateUserStatus(ctx context.Context, req *pb.UpdateUserStatusRequest) (*pb.UpdateUserStatusResponse, error) {
	if req.UserId == "" || req.Status == "" {
		return nil, status.Error(codes.InvalidArgument, "user_id and status are required")
	}
	
	var rolePtr *string
	if req.Role != "" {
		rolePtr = &req.Role
	}

	err := s.authService.UpdateUserStatus(ctx, req.UserId, req.Status, rolePtr)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update user status: %v", err)
	}

	return &pb.UpdateUserStatusResponse{
		Success: true,
		Message: "User status updated successfully",
	}, nil
}

func (s *AuthGrpcServer) DeleteUser(ctx context.Context, req *pb.DeleteUserRequest) (*pb.DeleteUserResponse, error) {
	if req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "user_id is required")
	}

	err := s.authService.DeleteUser(ctx, req.UserId, req.DeletedBy, req.HardDelete)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete user: %v", err)
	}

	return &pb.DeleteUserResponse{
		Success: true,
		Message: "User soft deleted successfully",
	}, nil
}

func (s *AuthGrpcServer) GetMasterRoles(ctx context.Context, req *pb.GetMasterRolesRequest) (*pb.GetMasterRolesResponse, error) {
	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	roles, err := s.queries.GetMasterRoles(ctx, db.GetMasterRolesParams{
		Column1: req.Search,
		Limit:   pageSize,
		Offset:  offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get master roles: %v", err)
	}

	count, err := s.queries.CountMasterRoles(ctx, req.Search)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count master roles: %v", err)
	}

	var pbRoles []*pb.MasterRole
	for _, r := range roles {
		pbRoles = append(pbRoles, &pb.MasterRole{
			Id:        r.ID,
			Deskripsi: r.Deskripsi.String,
		})
	}

	return &pb.GetMasterRolesResponse{
		Data:       pbRoles,
		TotalCount: int32(count),
	}, nil
}

func (s *AuthGrpcServer) GetDoctors(ctx context.Context, req *pb.GetDoctorsRequest) (*pb.GetDoctorsResponse, error) {
	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	doctors, err := s.queries.GetDoctors(ctx, db.GetDoctorsParams{
		Column1: req.Search,
		Limit:   pageSize,
		Offset:  offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get doctors: %v", err)
	}

	count, err := s.queries.CountDoctors(ctx, req.Search)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count doctors: %v", err)
	}

	var pbDocs []*pb.Doctor
	for _, d := range doctors {
		startDate := ""
		if d.StartDate.Valid {
			startDate = d.StartDate.Time.Format("2006-01-02")
		}
		endDate := ""
		if d.EndDate.Valid {
			endDate = d.EndDate.Time.Format("2006-01-02")
		}
		pbDocs = append(pbDocs, &pb.Doctor{
			Id:           d.ID.String(),
			Username:     d.Username,
			Nip:          d.Nip.String,
			Email:        d.Email.String,
			Spesialisasi: d.Spesialisasi.String,
			Sip:          d.Sip.String,
			Status:       d.Status.String,
			PoliCode:     d.PoliCode.String,
			StartDate:    startDate,
			EndDate:      endDate,
		})
	}

	return &pb.GetDoctorsResponse{
		Data:       pbDocs,
		TotalCount: int32(count),
	}, nil
}

func (s *AuthGrpcServer) GetNurses(ctx context.Context, req *pb.GetNursesRequest) (*pb.GetNursesResponse, error) {
	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	nurses, err := s.queries.GetNurses(ctx, db.GetNursesParams{
		Column1: req.Search,
		Limit:   pageSize,
		Offset:  offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get nurses: %v", err)
	}

	count, err := s.queries.CountNurses(ctx, req.Search)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count nurses: %v", err)
	}

	var pbNurses []*pb.Nurse
	for _, n := range nurses {
		startDate := ""
		if n.StartDate.Valid {
			startDate = n.StartDate.Time.Format("2006-01-02")
		}
		endDate := ""
		if n.EndDate.Valid {
			endDate = n.EndDate.Time.Format("2006-01-02")
		}
		pbNurses = append(pbNurses, &pb.Nurse{
			Id:         n.ID.String(),
			Username:   n.Username,
			Nip:        n.Nip.String,
			Email:      n.Email.String,
			StrPerawat: n.StrPerawat.String,
			Status:     n.Status.String,
			PoliCode:   n.PoliCode.String,
			StartDate:  startDate,
			EndDate:    endDate,
		})
	}

	return &pb.GetNursesResponse{
		Data:       pbNurses,
		TotalCount: int32(count),
	}, nil
}

func (s *AuthGrpcServer) GetDoctorsByPoli(ctx context.Context, req *pb.GetDoctorsByPoliRequest) (*pb.GetDoctorsByPoliResponse, error) {
	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	doctors, err := s.queries.GetDoctorsByPoli(ctx, db.GetDoctorsByPoliParams{
		Column1: req.PoliCode,
		Column2: req.Search,
		Limit:   pageSize,
		Offset:  offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get doctors by poli: %v", err)
	}

	count, err := s.queries.CountDoctorsByPoli(ctx, db.CountDoctorsByPoliParams{
		Column1: req.PoliCode,
		Column2: req.Search,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count doctors by poli: %v", err)
	}

	var pbDocs []*pb.DoctorPoliMapping
	for _, d := range doctors {
		pbDocs = append(pbDocs, &pb.DoctorPoliMapping{
			Id:           d.ID.String(),
			Username:     d.Username,
			Nip:          d.Nip.String,
			Spesialisasi: d.Spesialisasi.String,
			PoliCode:     d.PoliCode,
			StartDate:    d.StartDate.Format("2006-01-02"),
			EndDate:      d.EndDate.Format("2006-01-02"),
		})
	}

	return &pb.GetDoctorsByPoliResponse{
		Data:       pbDocs,
		TotalCount: int32(count),
	}, nil
}

func (s *AuthGrpcServer) GetNursesByPoli(ctx context.Context, req *pb.GetNursesByPoliRequest) (*pb.GetNursesByPoliResponse, error) {
	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	nurses, err := s.queries.GetNursesByPoli(ctx, db.GetNursesByPoliParams{
		Column1: req.PoliCode,
		Column2: req.Search,
		Limit:   pageSize,
		Offset:  offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get nurses by poli: %v", err)
	}

	count, err := s.queries.CountNursesByPoli(ctx, db.CountNursesByPoliParams{
		Column1: req.PoliCode,
		Column2: req.Search,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count nurses by poli: %v", err)
	}

	var pbNurses []*pb.NursePoliMapping
	for _, n := range nurses {
		pbNurses = append(pbNurses, &pb.NursePoliMapping{
			Id:         n.ID.String(),
			Username:   n.Username,
			Nip:        n.Nip.String,
			StrPerawat: n.StrPerawat.String,
			PoliCode:   n.PoliCode,
			StartDate:  n.StartDate.Format("2006-01-02"),
			EndDate:    n.EndDate.Format("2006-01-02"),
		})
	}

	return &pb.GetNursesByPoliResponse{
		Data:       pbNurses,
		TotalCount: int32(count),
	}, nil
}

func (s *AuthGrpcServer) AssignDoctorPoli(ctx context.Context, req *pb.AssignDoctorPoliRequest) (*pb.AssignDoctorPoliResponse, error) {
	if req.DokterId == "" || req.PoliCode == "" || req.StartDate == "" || req.EndDate == "" {
		return nil, status.Error(codes.InvalidArgument, "dokter_id, poli_code, start_date, and end_date are required")
	}
	
	dokterUUID, err := uuid.Parse(req.DokterId)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid dokter_id format")
	}

	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid start_date format, expected YYYY-MM-DD")
	}

	endDate, err := time.Parse("2006-01-02", req.EndDate)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid end_date format, expected YYYY-MM-DD")
	}

	if endDate.Before(startDate) {
		return nil, status.Error(codes.InvalidArgument, "end_date cannot be before start_date")
	}

	isOverlap, err := s.queries.CheckDoctorAssignmentOverlap(ctx, db.CheckDoctorAssignmentOverlapParams{
		DokterID:  dokterUUID,
		StartDate: startDate,
		EndDate:   endDate,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to check assignment overlap: %v", err)
	}
	if isOverlap {
		return nil, status.Error(codes.FailedPrecondition, "Doctor is already assigned to a polyclinic during this period")
	}

	_, err = s.queries.AssignDoctorToPoli(ctx, db.AssignDoctorToPoliParams{
		DokterID:  dokterUUID,
		PoliCode:  req.PoliCode,
		StartDate: startDate,
		EndDate:   endDate,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to assign doctor to poli: %v", err)
	}

	return &pb.AssignDoctorPoliResponse{
		Success: true,
		Message: "Doctor assigned successfully",
	}, nil
}

func (s *AuthGrpcServer) AssignNursePoli(ctx context.Context, req *pb.AssignNursePoliRequest) (*pb.AssignNursePoliResponse, error) {
	if req.PerawatId == "" || req.PoliCode == "" || req.StartDate == "" || req.EndDate == "" {
		return nil, status.Error(codes.InvalidArgument, "perawat_id, poli_code, start_date, and end_date are required")
	}
	
	perawatUUID, err := uuid.Parse(req.PerawatId)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid perawat_id format")
	}

	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid start_date format, expected YYYY-MM-DD")
	}

	endDate, err := time.Parse("2006-01-02", req.EndDate)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid end_date format, expected YYYY-MM-DD")
	}

	if endDate.Before(startDate) {
		return nil, status.Error(codes.InvalidArgument, "end_date cannot be before start_date")
	}

	isOverlap, err := s.queries.CheckNurseAssignmentOverlap(ctx, db.CheckNurseAssignmentOverlapParams{
		PerawatID: perawatUUID,
		StartDate: startDate,
		EndDate:   endDate,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to check assignment overlap: %v", err)
	}
	if isOverlap {
		return nil, status.Error(codes.FailedPrecondition, "Nurse is already assigned to a polyclinic during this period")
	}

	_, err = s.queries.AssignNurseToPoli(ctx, db.AssignNurseToPoliParams{
		PerawatID: perawatUUID,
		PoliCode:  req.PoliCode,
		StartDate: startDate,
		EndDate:   endDate,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to assign nurse to poli: %v", err)
	}

	return &pb.AssignNursePoliResponse{
		Success: true,
		Message: "Nurse successfully assigned to poli",
	}, nil
}

func (s *AuthGrpcServer) GetAssignedPoli(ctx context.Context, req *pb.GetAssignedPoliRequest) (*pb.GetAssignedPoliResponse, error) {
	if req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "user id is required")
	}

	uid, err := uuid.Parse(req.UserId)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid user id format")
	}

	poliCode, err := s.queries.GetAssignedPoli(ctx, uid)
	if err != nil {
		// It's possible the user is not assigned to any poli (e.g., admin, or doctor not on duty)
		// Instead of returning error, just return empty poli_code
		return &pb.GetAssignedPoliResponse{
			PoliCode: "",
		}, nil
	}

	return &pb.GetAssignedPoliResponse{
		PoliCode: poliCode,
	}, nil
}

func (s *AuthGrpcServer) GetActivePersonnelMetrics(ctx context.Context, req *pb.GetActivePersonnelMetricsRequest) (*pb.GetActivePersonnelMetricsResponse, error) {
	activePolis, err := s.queries.CountActivePolis(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count active polis: %v", err)
	}

	activeDoctors, err := s.queries.CountActiveDoctors(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count active doctors: %v", err)
	}

	activeNurses, err := s.queries.CountActiveNurses(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to count active nurses: %v", err)
	}

	return &pb.GetActivePersonnelMetricsResponse{
		ActiveClinics: int32(activePolis),
		ActiveDoctors: int32(activeDoctors),
		ActiveNurses:  int32(activeNurses),
	}, nil
}

func (s *AuthGrpcServer) ListLabelProfesi(ctx context.Context, req *pb.ListLabelProfesiRequest) (*pb.ListLabelProfesiResponse, error) {
	page := int(req.Page)
	if page <= 0 {
		page = 1
	}
	pageSize := int(req.PageSize)
	if pageSize <= 0 {
		pageSize = 10
	}

	labels, err := s.queries.GetMasterLabelProfesi(ctx, db.GetMasterLabelProfesiParams{
		Column1: req.Search,
		Limit:   int32(pageSize),
		Offset:  int32((page - 1) * pageSize),
	})
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	totalCount, err := s.queries.CountMasterLabelProfesi(ctx, req.Search)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	var pbLabels []*pb.LabelProfesi
	for _, l := range labels {
		pbLabels = append(pbLabels, &pb.LabelProfesi{
			Id:        l.ID,
			NamaLabel: l.NamaLabel,
			IsActive:  l.IsActive,
		})
	}

	return &pb.ListLabelProfesiResponse{
		Data:       pbLabels,
		TotalCount: int32(totalCount),
	}, nil
}
