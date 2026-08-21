package main

import (
	"context"
	"log"
	"log/slog"
	"net"
	"os"

	"net/http"
	"google.golang.org/grpc"
	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/recovery"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	grpcAdapter "github.com/aliube/go-micro-simrs-one/auth-service/internal/adapters/grpc"
	authdb "github.com/aliube/go-micro-simrs-one/auth-service/internal/adapters/db"
	"github.com/aliube/go-micro-simrs-one/auth-service/internal/adapters/repository"
	"github.com/aliube/go-micro-simrs-one/auth-service/internal/core/services"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/auth"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/db"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/shutdown"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/telemetry"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/auth/v1"
)

func main() {
	// 1. Init Telemetry
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
			slog.Error("Error shutting down tracer provider", "error", err)
		}
	}()

	// 2. Init Core Dependencies
	symmetricKeyHex := os.Getenv("PASETO_SYMMETRIC_KEY")
	if symmetricKeyHex == "" {
		symmetricKeyHex = "59454c4c4f57205355424d4152494e452c20424c41434b2057495a4152445259"
	}
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

	// --- Bootstrapping Initial Admin & SuperAdmin ---
	_, err = dbConn.Exec(`
		INSERT INTO auth.master_role (id, deskripsi) VALUES ('admin', 'Administrator'), ('super_admin', 'Super Administrator') 
		ON CONFLICT DO NOTHING
	`)
	if err != nil {
		slog.Error("Failed to seed initial roles", "error", err)
	}

	initAdminUser := os.Getenv("INITIAL_ADMIN_USERNAME")
	initAdminPass := os.Getenv("INITIAL_ADMIN_PASSWORD")
	if initAdminUser == "" {
		initAdminUser = "admin"
	}
	if initAdminPass == "" {
		initAdminPass = "admin123"
	}

	err = authService.BootstrapAdmin(context.Background(), initAdminUser, initAdminPass, "admin@example.com", "")
	if err != nil {
		if err.Error() == "NIP already registered" {
			slog.Info("Initial admin user already exists", "username", initAdminUser)
		} else {
			slog.Error("Failed to bootstrap initial admin user", "error", err)
		}
	} else {
		slog.Info("Initial admin user created successfully", "username", initAdminUser)
	}

	err = authService.BootstrapSuperAdmin(context.Background(), "superadmin", "admin123", "superadmin@example.com", "")
	if err != nil {
		if err.Error() == "super admin already registered" {
			slog.Info("Initial superadmin user already exists", "username", "superadmin")
		} else {
			slog.Error("Failed to bootstrap initial superadmin user", "error", err)
		}
	} else {
		slog.Info("Initial superadmin user created successfully", "username", "superadmin")
	}
	// -----------------------------------

	// 4. Init gRPC Server
	grpcServer := grpc.NewServer(
		grpc.ChainUnaryInterceptor(
			recovery.UnaryServerInterceptor(),
		),
	)
	authGrpcHandler := grpcAdapter.NewAuthGrpcServer(authService, authdb.New(dbConn))
	pb.RegisterAuthServiceServer(grpcServer, authGrpcHandler)

	// 5. Register gRPC Health Check
	healthSrv := health.NewServer()
	grpc_health_v1.RegisterHealthServer(grpcServer, healthSrv)
	healthSrv.SetServingStatus("", grpc_health_v1.HealthCheckResponse_SERVING)

	port := os.Getenv("PORT")
	if port == "" {
		port = "50051"
	}

	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("failed to listen on port %s: %v", port, err)
	}

	// 6. Graceful Shutdown
	ctx, cancel := shutdown.WaitForSignal()
	defer cancel()

	go func() {
		slog.Info("Auth Service (gRPC) is running", "port", port)
		if err := grpcServer.Serve(listener); err != nil {
			log.Fatalf("failed to serve gRPC: %v", err)
		}
	}()

	// 7. Prometheus Metrics Server
	go func() {
		mux := http.NewServeMux()
		mux.Handle("/metrics", promhttp.Handler())
		slog.Info("Auth Service Metrics running", "port", "9091")
		if err := http.ListenAndServe(":9091", mux); err != nil {
			slog.Error("failed to serve metrics", "error", err)
		}
	}()

	<-ctx.Done()
	slog.Info("Gracefully stopping Auth Service...")
	grpcServer.GracefulStop()
	slog.Info("Auth Service stopped.")
}
