package main

import (
	"log"
	"log/slog"
	"net"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc"
	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/recovery"
	"net/http"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/adapters/consumer"
	adapterDB "github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/adapters/db"
	grpcAdapter "github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/adapters/grpc"
	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/adapters/repository"
	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/adapters/worker"
	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/core/services"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/db"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/outbox"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/shutdown"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/telemetry"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/pharmacy/v1"
)

func main() {
	// 1. Init Telemetry
	jaegerEndpoint := os.Getenv("JAEGER_ENDPOINT")
	if jaegerEndpoint == "" {
		jaegerEndpoint = "localhost:4318"
	}
	tp, err := telemetry.InitJaegerTracer("pharmacy-service", jaegerEndpoint)
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
	dbConn, err := db.ConnectPostgres("pharmacy")
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer dbConn.Close()

	pharmacyRepo := repository.NewPharmacyRepository(dbConn)
	pharmacyService := services.NewPharmacyService(pharmacyRepo, rdb)

	// 4. Graceful Shutdown context (used for background workers)
	ctx, cancel := shutdown.WaitForSignal()
	defer cancel()

	// 5. Init Outbox Relay Worker
	if outboxRepo, ok := pharmacyRepo.(outbox.Repository); ok {
		pharmacyRelay := outbox.NewRelay(outboxRepo, rdb, "pharmacy_stream", 5*time.Second)
		go pharmacyRelay.Start(ctx)
		slog.Info("Pharmacy Outbox Relay started")
	} else {
		log.Fatalf("pharmacyRepo does not implement outbox.Repository")
	}

	// 6. Init Billing Consumer
	consumer.StartBillingConsumer(ctx, rdb, pharmacyRepo)
	slog.Info("Billing Consumer started in Pharmacy Service")

	// 6.5 Init Aggregator Worker
	queriesRepo := adapterDB.New(dbConn)
	worker.StartAggregatorWorker(queriesRepo)
	slog.Info("Pharmacy Aggregator Worker started")

	// 7. Init gRPC Server
	grpcServer := grpc.NewServer(
		grpc.ChainUnaryInterceptor(
			recovery.UnaryServerInterceptor(),
		),
	)
	pb.RegisterPharmacyServiceServer(grpcServer, grpcAdapter.NewPharmacyGrpcServer(pharmacyService, queriesRepo))

	// 8. Register gRPC Health Check
	healthSrv := health.NewServer()
	grpc_health_v1.RegisterHealthServer(grpcServer, healthSrv)
	healthSrv.SetServingStatus("", grpc_health_v1.HealthCheckResponse_SERVING)

	port := os.Getenv("PORT")
	if port == "" {
		port = "50055"
	}
	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("failed to listen on port %s: %v", port, err)
	}

	go func() {
		slog.Info("Pharmacy Service (gRPC) is running", "port", port)
		if err := grpcServer.Serve(listener); err != nil {
			log.Fatalf("failed to serve gRPC: %v", err)
		}
	}()

	// 7. Prometheus Metrics Server
	go func() {
		mux := http.NewServeMux()
		mux.Handle("/metrics", promhttp.Handler())
		slog.Info("Pharmacy Service Metrics running", "port", "9095")
		if err := http.ListenAndServe(":9095", mux); err != nil {
			slog.Error("failed to serve metrics", "error", err)
		}
	}()

	<-ctx.Done()
	slog.Info("Gracefully stopping Pharmacy Service...")
	grpcServer.GracefulStop()
	slog.Info("Pharmacy Service stopped.")
}
