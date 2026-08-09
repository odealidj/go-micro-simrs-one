package main

import (
	"log"
	"net"
	"os"

	"google.golang.org/grpc"

	grpcAdapter "github.com/aliube/go-micro-simrs-one/auth-service/internal/adapters/grpc"
	"github.com/aliube/go-micro-simrs-one/auth-service/internal/core/services"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/auth"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/telemetry"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/auth/v1"
)

func main() {
	// 1. Init Telemetry
	// Default OTLP HTTP endpoint for Jaeger is localhost:4318
	jaegerEndpoint := os.Getenv("JAEGER_ENDPOINT")
	if jaegerEndpoint == "" {
		jaegerEndpoint = "localhost:4318"
	}
	
	tp, err := telemetry.InitJaegerTracer("auth-service", jaegerEndpoint)
	if err != nil {
		log.Fatalf("failed to init telemetry: %v", err)
	}
	defer func() {
		if err := tp.Shutdown(nil); err != nil {
			log.Printf("Error shutting down tracer provider: %v", err)
		}
	}()

	// 2. Init Core Dependencies
	// Symmetric Key for PASETO must be exactly 32 bytes long
	symmetricKey := []byte("YELLOW SUBMARINE, BLACK WIZARDRY")
	tokenManager, err := auth.NewTokenManager(symmetricKey)
	if err != nil {
		log.Fatalf("failed to init token manager: %v", err)
	}

	// TODO: Replace nil with actual Postgres Repository in next phase
	authService := services.NewAuthService(nil, tokenManager)
	
	// 3. Init gRPC Server
	grpcServer := grpc.NewServer()
	authGrpcHandler := grpcAdapter.NewAuthGrpcServer(authService)
	
	pb.RegisterAuthServiceServer(grpcServer, authGrpcHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "50051"
	}

	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("failed to listen on port %s: %v", port, err)
	}

	log.Printf("Auth Service (gRPC) is running on port %s", port)
	if err := grpcServer.Serve(listener); err != nil {
		log.Fatalf("failed to serve gRPC: %v", err)
	}
}
