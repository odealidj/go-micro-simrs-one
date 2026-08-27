package main

import (
	"log"
	"log/slog"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/recovery"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"

	"github.com/aliube/go-micro-simrs-one/rawat-jalan-service/internal/adapters/broker"
	adapterDB "github.com/aliube/go-micro-simrs-one/rawat-jalan-service/internal/adapters/db"
	grpcAdapter "github.com/aliube/go-micro-simrs-one/rawat-jalan-service/internal/adapters/grpc"
	"github.com/aliube/go-micro-simrs-one/rawat-jalan-service/internal/adapters/repository"
	"github.com/aliube/go-micro-simrs-one/rawat-jalan-service/internal/adapters/worker"
	"github.com/aliube/go-micro-simrs-one/rawat-jalan-service/internal/core/services"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/db"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/outbox"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/shutdown"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/telemetry"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/rawat_jalan/v1"
)

func main() {
	// 1. Init Telemetry
	jaegerEndpoint := os.Getenv("JAEGER_ENDPOINT")
	if jaegerEndpoint == "" {
		jaegerEndpoint = "localhost:4318"
	}
	tp, err := telemetry.InitJaegerTracer("rawat-jalan-service", jaegerEndpoint)
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
	dbConn, err := db.ConnectPostgres("rawat_jalan")
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer dbConn.Close()

	emrRepo := repository.NewEMRRepository(dbConn)
	emrService := services.NewEMRService(emrRepo, rdb)

	// 4. Graceful Shutdown context (used for background workers)
	ctx, cancel := shutdown.WaitForSignal()
	defer cancel()

	// 5. Start Registration Event Consumer (Consumer Group — safe on restart)
	registrationConsumer := broker.NewRegistrationEventConsumer(rdb, emrService)
	go registrationConsumer.Start(ctx)
	slog.Info("Rawat Jalan Registration Event Consumer started", "stream", "registration.events", "group", "rawat-jalan-group")

	// 6. Init Outbox Relay Worker
	if outboxRepo, ok := emrRepo.(outbox.Repository); ok {
		relay := outbox.NewRelay(outboxRepo, rdb, "rawat_jalan_stream", 5*time.Second)
		go relay.Start(ctx)
		slog.Info("Rawat Jalan Outbox Relay started")
	} else {
		log.Fatalf("emrRepo does not implement outbox.Repository")
	}

	// 6.5 Init Aggregator Worker & Master Data Sync Worker
	queriesRepo := adapterDB.New(dbConn)
	worker.StartAggregatorWorker(queriesRepo)
	slog.Info("Rawat Jalan Aggregator Worker started")

	masterSyncConsumer := broker.NewClinicalMasterSyncConsumer(rdb, queriesRepo)
	go masterSyncConsumer.Start(ctx)
	slog.Info("Rawat Jalan Clinical Master Sync Consumer started", "stream", "clinical_master_stream", "group", "rawat-jalan-master-sync")

	// 7. Init gRPC Server
	grpcServer := grpc.NewServer(
		grpc.ChainUnaryInterceptor(
			recovery.UnaryServerInterceptor(),
		),
	)
	pb.RegisterRawatJalanServiceServer(grpcServer, grpcAdapter.NewRawatJalanGrpcServer(emrService, queriesRepo))

	// 8. Register gRPC Health Check
	healthSrv := health.NewServer()
	grpc_health_v1.RegisterHealthServer(grpcServer, healthSrv)
	healthSrv.SetServingStatus("", grpc_health_v1.HealthCheckResponse_SERVING)

	port := os.Getenv("PORT")
	if port == "" {
		port = "50057"
	}
	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("failed to listen on port %s: %v", port, err)
	}

	go func() {
		slog.Info("Rawat Jalan Service (gRPC) is running", "port", port)
		if err := grpcServer.Serve(listener); err != nil {
			log.Fatalf("failed to serve gRPC: %v", err)
		}
	}()

	// 9. Prometheus Metrics Server
	metricsPort := os.Getenv("METRICS_PORT")
	if metricsPort == "" {
		metricsPort = "9097"
	}
	go func() {
		mux := http.NewServeMux()
		mux.Handle("/metrics", promhttp.Handler())
		slog.Info("Rawat Jalan Service Metrics running", "port", metricsPort)
		if err := http.ListenAndServe(":"+metricsPort, mux); err != nil {
			slog.Error("failed to serve metrics", "error", err)
		}
	}()

	<-ctx.Done()
	slog.Info("Gracefully stopping Rawat Jalan Service...")
	grpcServer.GracefulStop()
	slog.Info("Rawat Jalan Service stopped.")
}
