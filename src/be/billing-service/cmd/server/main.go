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

	grpcAdapter "github.com/aliube/go-micro-simrs-one/billing-service/internal/adapters/grpc"
	"github.com/aliube/go-micro-simrs-one/billing-service/internal/adapters/repository"
	"github.com/aliube/go-micro-simrs-one/billing-service/internal/core/services"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/db"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/outbox"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/shutdown"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/telemetry"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/billing/v1"
)

func main() {
	// 1. Init Telemetry
	jaegerEndpoint := os.Getenv("JAEGER_ENDPOINT")
	if jaegerEndpoint == "" {
		jaegerEndpoint = "localhost:4318"
	}
	tp, err := telemetry.InitJaegerTracer("billing-service", jaegerEndpoint)
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
	dbConn, err := db.ConnectPostgres("billing")
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer dbConn.Close()

	billingRepo := repository.NewBillingRepository(dbConn)
	billingService := services.NewBillingService(billingRepo)

	// 4. Graceful Shutdown context (used for background workers)
	ctx, cancel := shutdown.WaitForSignal()
	defer cancel()

	// 5. Init Outbox Relay Worker
	if outboxRepo, ok := billingRepo.(outbox.Repository); ok {
		billingRelay := outbox.NewRelay(outboxRepo, rdb, "billing_stream", 5*time.Second)
		go billingRelay.Start(ctx)
		slog.Info("Billing Outbox Relay started")
	} else {
		log.Fatalf("billingRepo does not implement outbox.Repository")
	}

	// 6. Start Consumers (Listening to EMR and Pharmacy streams)
	services.StartBillingConsumers(ctx, rdb, billingService)

	// 7. Init gRPC Server
	grpcServer := grpc.NewServer()
	pb.RegisterBillingServiceServer(grpcServer, grpcAdapter.NewBillingGrpcServer(billingService))

	// 8. Register gRPC Health Check
	healthSrv := health.NewServer()
	grpc_health_v1.RegisterHealthServer(grpcServer, healthSrv)
	healthSrv.SetServingStatus("", grpc_health_v1.HealthCheckResponse_SERVING)

	port := os.Getenv("PORT")
	if port == "" {
		port = "50056"
	}
	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("failed to listen on port %s: %v", port, err)
	}

	go func() {
		slog.Info("Billing Service (gRPC) is running", "port", port)
		if err := grpcServer.Serve(listener); err != nil {
			log.Fatalf("failed to serve gRPC: %v", err)
		}
	}()

	<-ctx.Done()
	slog.Info("Gracefully stopping Billing Service...")
	grpcServer.GracefulStop()
	slog.Info("Billing Service stopped.")
}
