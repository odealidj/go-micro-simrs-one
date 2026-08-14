package main

import (
	"log"
	"log/slog"
	"net"
	"os"

	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc"
	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/recovery"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"

	grpcAdapter "github.com/aliube/go-micro-simrs-one/patient-service/internal/adapters/grpc"
	"github.com/aliube/go-micro-simrs-one/patient-service/internal/adapters/repository"
	"github.com/aliube/go-micro-simrs-one/patient-service/internal/core/services"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/db"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/shutdown"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/telemetry"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/patient/v1"
)

func main() {
	// 1. Init Telemetry
	jaegerEndpoint := os.Getenv("JAEGER_ENDPOINT")
	if jaegerEndpoint == "" {
		jaegerEndpoint = "localhost:4318"
	}
	tp, err := telemetry.InitJaegerTracer("patient-service", jaegerEndpoint)
	if err != nil {
		log.Fatalf("failed to init telemetry: %v", err)
	}
	defer func() {
		if err := tp.Shutdown(nil); err != nil {
			slog.Error("Error shutting down tracer provider", "error", err)
		}
	}()

	// 2. Init Redis Client
	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "localhost:6379"
	}
	rdb := redis.NewClient(&redis.Options{Addr: redisHost})

	// 3. Init Database
	dbConn, err := db.ConnectPostgres("patient")
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer dbConn.Close()

	patientRepo := repository.NewPatientRepository(dbConn)
	patientService := services.NewPatientService(patientRepo, rdb)

	// 4. Init gRPC Server
	grpcServer := grpc.NewServer(
		grpc.ChainUnaryInterceptor(
			recovery.UnaryServerInterceptor(),
		),
	)
	pb.RegisterPatientServiceServer(grpcServer, grpcAdapter.NewPatientGrpcServer(patientService))

	// 5. Register gRPC Health Check
	healthSrv := health.NewServer()
	grpc_health_v1.RegisterHealthServer(grpcServer, healthSrv)
	healthSrv.SetServingStatus("", grpc_health_v1.HealthCheckResponse_SERVING)

	port := os.Getenv("PORT")
	if port == "" {
		port = "50052"
	}
	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("failed to listen on port %s: %v", port, err)
	}

	// 6. Graceful Shutdown
	ctx, cancel := shutdown.WaitForSignal()
	defer cancel()

	go func() {
		slog.Info("Patient Service (gRPC) is running", "port", port)
		if err := grpcServer.Serve(listener); err != nil {
			log.Fatalf("failed to serve gRPC: %v", err)
		}
	}()

	<-ctx.Done()
	slog.Info("Gracefully stopping Patient Service...")
	grpcServer.GracefulStop()
	slog.Info("Patient Service stopped.")
}
