package main

import (
	"log"
	"net"
	"os"

	"google.golang.org/grpc"

	grpcAdapter "github.com/aliube/go-micro-simrs-one/auth-service/internal/adapters/grpc"
	"github.com/aliube/go-micro-simrs-one/auth-service/internal/adapters/repository"
	"github.com/aliube/go-micro-simrs-one/auth-service/internal/core/services"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/auth"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/db"
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
	// Symmetric Key for PASETO must be exactly 32 bytes long, provided as a hex string
	symmetricKeyHex := "59454c4c4f57205355424d4152494e452c20424c41434b2057495a4152445259"
	tokenManager, err := auth.NewTokenManager(symmetricKeyHex)
	if err != nil {
		log.Fatalf("failed to init token manager: %v", err)
	}

	// 3. Init Database
	dbConn, err := db.ConnectPostgres("auth")
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer dbConn.Close()

	authRepo := repository.NewUserRepository(dbConn)
	authService := services.NewAuthService(authRepo, tokenManager)
	
	// 4. Init gRPC Server
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
