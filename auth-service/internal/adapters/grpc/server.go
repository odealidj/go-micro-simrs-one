package grpc

import (
	"context"

	"github.com/aliube/go-micro-simrs-one/auth-service/internal/core/ports"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/auth/v1"
)

type AuthGrpcServer struct {
	pb.UnimplementedAuthServiceServer
	authService ports.AuthService
}

func NewAuthGrpcServer(service ports.AuthService) *AuthGrpcServer {
	return &AuthGrpcServer{
		authService: service,
	}
}

func (s *AuthGrpcServer) Login(ctx context.Context, req *pb.LoginRequest) (*pb.LoginResponse, error) {
	token, role, userID, err := s.authService.Login(ctx, req.Username, req.Password)
	if err != nil {
		return &pb.LoginResponse{Success: false}, nil
	}
	return &pb.LoginResponse{
		Success: true,
		Token:   token,
		Role:    role,
		UserId:  userID,
	}, nil
}

func (s *AuthGrpcServer) ValidateToken(ctx context.Context, req *pb.ValidateTokenRequest) (*pb.ValidateTokenResponse, error) {
	isValid, role, userID, err := s.authService.ValidateToken(ctx, req.Token)
	if err != nil {
		return &pb.ValidateTokenResponse{Valid: false}, nil
	}

	return &pb.ValidateTokenResponse{
		Valid:  isValid,
		UserId: userID,
		Role:   role,
	}, nil
}
