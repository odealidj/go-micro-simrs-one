package main

import (
	"log"
	"log/slog"
	"net"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"

	grpcAdapter "github.com/aliube/go-micro-simrs-one/registration-service/internal/adapters/grpc"
	"github.com/aliube/go-micro-simrs-one/registration-service/internal/adapters/repository"
	"github.com/aliube/go-micro-simrs-one/registration-service/internal/core/services"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/db"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/queue"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/shutdown"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/telemetry"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/registration/v1"
)

func main() {
	// 1. Init Telemetry
	jaegerEndpoint := os.Getenv("JAEGER_ENDPOINT")
	if jaegerEndpoint == "" {
		jaegerEndpoint = "localhost:4318"
	}
	tp, err := telemetry.InitJaegerTracer("registration-service", jaegerEndpoint)
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
	dbConn, err := db.ConnectPostgres("registration")
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer dbConn.Close()

	registrationRepo := repository.NewRegistrationRepository(dbConn)
	estimator := queue.NewStatisticalQueueEstimator(15 * time.Minute)
	registrationService := services.NewRegistrationService(registrationRepo, rdb, estimator)

	// 4. Init gRPC Server
	grpcServer := grpc.NewServer()
	pb.RegisterRegistrationServiceServer(grpcServer, grpcAdapter.NewRegistrationGrpcServer(registrationService))

	// 5. Register gRPC Health Check
	healthSrv := health.NewServer()
	grpc_health_v1.RegisterHealthServer(grpcServer, healthSrv)
	healthSrv.SetServingStatus("", grpc_health_v1.HealthCheckResponse_SERVING)

	port := os.Getenv("PORT")
	if port == "" {
		port = "50053"
	}
	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("failed to listen on port %s: %v", port, err)
	}

	// 6. Graceful Shutdown
	ctx, cancel := shutdown.WaitForSignal()
	defer cancel()

	go func() {
		slog.Info("Registration Service (gRPC) is running", "port", port)
		if err := grpcServer.Serve(listener); err != nil {
			log.Fatalf("failed to serve gRPC: %v", err)
		}
	}()

	<-ctx.Done()
	slog.Info("Gracefully stopping Registration Service...")
	grpcServer.GracefulStop()
	slog.Info("Registration Service stopped.")
}
