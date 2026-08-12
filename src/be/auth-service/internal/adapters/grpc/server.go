package grpc

import (
	"context"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/aliube/go-micro-simrs-one/auth-service/internal/core/ports"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/auth/v1"
)

type AuthGrpcServer struct {
	pb.UnimplementedAuthServiceServer
	authService ports.AuthService
}

func NewAuthGrpcServer(service ports.AuthService) *AuthGrpcServer {
	return &AuthGrpcServer{authService: service}
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
	if req.Username == "" || req.Password == "" || req.Role == "" {
		return nil, status.Error(codes.InvalidArgument, "username, password, and role are required")
	}

	userID, err := s.authService.Signup(ctx, req.Username, req.Password, req.Role)
	if err != nil {
		if err.Error() == "username already exists" {
			return nil, status.Error(codes.AlreadyExists, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &pb.SignupResponse{
		Success: true,
		UserId:  userID,
		Message: "User registered successfully",
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
