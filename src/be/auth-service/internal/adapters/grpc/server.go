package grpc

import (
	"context"
	"time"

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
	tokenPair, role, userID, err := s.authService.Login(ctx, req.Username, req.Password)
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
		return nil, status.Error(codes.InvalidArgument, "username (nip) and password are required")
	}

	userID, err := s.authService.Signup(ctx, req.Username, req.Password, req.Email, req.Phone)
	if err != nil {
		if err.Error() == "NIP already registered" {
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
	users, totalCount, err := s.authService.ListUsers(ctx, int(req.Page), int(req.PageSize), req.StatusFilter)
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

	err := s.authService.DeleteUser(ctx, req.UserId, req.DeletedBy)
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
		pbDocs = append(pbDocs, &pb.Doctor{
			Id:           d.ID.String(),
			Username:     d.Username,
			Nip:          d.Nip.String,
			Email:        d.Email.String,
			Spesialisasi: d.Spesialisasi.String,
			Sip:          d.Sip.String,
			Status:       d.Status.String,
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
		pbNurses = append(pbNurses, &pb.Nurse{
			Id:         n.ID.String(),
			Username:   n.Username,
			Nip:        n.Nip.String,
			Email:      n.Email.String,
			StrPerawat: n.StrPerawat.String,
			Status:     n.Status.String,
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
		})
	}

	return &pb.GetNursesByPoliResponse{
		Data:       pbNurses,
		TotalCount: int32(count),
	}, nil
}

