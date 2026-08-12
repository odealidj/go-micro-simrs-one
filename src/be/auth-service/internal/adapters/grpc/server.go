package grpc

import (
	"context"

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
	token, role, userID, err := s.authService.Login(ctx, req.Username, req.Password)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "invalid credentials: %v", err)
	}
	return &pb.LoginResponse{
		Success: true,
		Token:   token,
		Role:    role,
		UserId:  userID,
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
