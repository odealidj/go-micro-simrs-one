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

	"github.com/aliube/go-micro-simrs-one/emr-service/internal/adapters/broker"
	grpcAdapter "github.com/aliube/go-micro-simrs-one/emr-service/internal/adapters/grpc"
	"github.com/aliube/go-micro-simrs-one/emr-service/internal/adapters/repository"
	"github.com/aliube/go-micro-simrs-one/emr-service/internal/core/services"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/db"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/outbox"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/shutdown"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/telemetry"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/emr/v1"
)

func main() {
	// 1. Init Telemetry
	jaegerEndpoint := os.Getenv("JAEGER_ENDPOINT")
	if jaegerEndpoint == "" {
		jaegerEndpoint = "localhost:4318"
	}
	tp, err := telemetry.InitJaegerTracer("emr-service", jaegerEndpoint)
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
	dbConn, err := db.ConnectPostgres("emr")
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer dbConn.Close()

	emrRepo := repository.NewEMRRepository(dbConn)
	emrService := services.NewEMRService(emrRepo)

	// 4. Graceful Shutdown context (used for background workers)
	ctx, cancel := shutdown.WaitForSignal()
	defer cancel()

	// 5. Init Event Subscriber
	subscriber := broker.NewRedisSubscriber(rdb, emrService)
	if err = subscriber.StartListening(ctx, "registration.events"); err != nil {
		log.Fatalf("Failed to start subscriber: %v", err)
	}

	// 6. Init Outbox Relay Worker
	if outboxRepo, ok := emrRepo.(outbox.Repository); ok {
		emrRelay := outbox.NewRelay(outboxRepo, rdb, "emr_stream", 5*time.Second)
		go emrRelay.Start(ctx)
		slog.Info("EMR Outbox Relay started")
	} else {
		log.Fatalf("emrRepo does not implement outbox.Repository")
	}

	// 7. Init gRPC Server
	grpcServer := grpc.NewServer()
	pb.RegisterEMRServiceServer(grpcServer, grpcAdapter.NewEMRGrpcServer(emrService))

	// 8. Register gRPC Health Check
	healthSrv := health.NewServer()
	grpc_health_v1.RegisterHealthServer(grpcServer, healthSrv)
	healthSrv.SetServingStatus("", grpc_health_v1.HealthCheckResponse_SERVING)

	port := os.Getenv("PORT")
	if port == "" {
		port = "50054"
	}
	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("failed to listen on port %s: %v", port, err)
	}

	go func() {
		slog.Info("EMR Service (gRPC) is running", "port", port)
		if err := grpcServer.Serve(listener); err != nil {
			log.Fatalf("failed to serve gRPC: %v", err)
		}
	}()

	<-ctx.Done()
	slog.Info("Gracefully stopping EMR Service...")
	grpcServer.GracefulStop()
	slog.Info("EMR Service stopped.")
}
