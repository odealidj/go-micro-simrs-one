package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
	"google.golang.org/genai"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/aliube/go-micro-simrs-one/api-gateway/internal/adapters/grpcadapter"
	"github.com/aliube/go-micro-simrs-one/api-gateway/internal/handlers"
	"github.com/aliube/go-micro-simrs-one/api-gateway/internal/middleware"
	"github.com/aliube/go-micro-simrs-one/api-gateway/internal/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/auth"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/circuitbreaker"
	simrsmiddleware "github.com/aliube/go-micro-simrs-one/shared/pkg/middleware"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/response"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/shutdown"
	authpb "github.com/aliube/go-micro-simrs-one/shared/proto/auth/v1"
	billingpb "github.com/aliube/go-micro-simrs-one/shared/proto/billing/v1"
	emrpb "github.com/aliube/go-micro-simrs-one/shared/proto/emr/v1"
	patientpb "github.com/aliube/go-micro-simrs-one/shared/proto/patient/v1"
	pharmacypb "github.com/aliube/go-micro-simrs-one/shared/proto/pharmacy/v1"
	rawatjalanpb "github.com/aliube/go-micro-simrs-one/shared/proto/rawat_jalan/v1"
	regpb "github.com/aliube/go-micro-simrs-one/shared/proto/registration/v1"
)

func loadEnv() {
	paths := []string{".env", "../../.env", "../../../.env"}
	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		for _, line := range strings.Split(string(data), "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				k := strings.TrimSpace(parts[0])
				v := strings.TrimSpace(parts[1])
				v = strings.Trim(v, `"'`)
				if os.Getenv(k) == "" {
					os.Setenv(k, v)
				}
			}
		}
		break
	}
}

func mustEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func mustGRPC(addr, service string) *grpc.ClientConn {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("failed to connect to %s (%s): %v", service, addr, err)
	}
	return conn
}

func main() {
	loadEnv()

	// ── gRPC Connections ──────────────────────────────────────────────────────
	authConn := mustGRPC(mustEnv("AUTH_SERVICE_ADDR", "localhost:50051"), "auth")
	defer authConn.Close()
	patientConn := mustGRPC(mustEnv("PATIENT_SERVICE_ADDR", "localhost:50052"), "patient")
	defer patientConn.Close()
	regConn := mustGRPC(mustEnv("REGISTRATION_SERVICE_ADDR", "localhost:50053"), "registration")
	defer regConn.Close()
	emrAddr := mustEnv("MEDICAL_RECORD_SERVICE_ADDR", mustEnv("EMR_SERVICE_ADDR", "localhost:50054"))
	emrConn := mustGRPC(emrAddr, "emr")
	defer emrConn.Close()
	rawatJalanConn := mustGRPC(mustEnv("RAWAT_JALAN_SERVICE_ADDR", "localhost:50057"), "rawat-jalan")
	defer rawatJalanConn.Close()
	pharmacyConn := mustGRPC(mustEnv("PHARMACY_SERVICE_ADDR", "localhost:50055"), "pharmacy")
	defer pharmacyConn.Close()
	billingConn := mustGRPC(mustEnv("BILLING_SERVICE_ADDR", "localhost:50056"), "billing")
	defer billingConn.Close()

	// ── Circuit Breakers ──────────────────────────────────────────────────────
	cbAuth := circuitbreaker.NewGRPCBreaker("auth-service")
	cbPatient := circuitbreaker.NewGRPCBreaker("patient-service")
	cbReg := circuitbreaker.NewGRPCBreaker("registration-service")
	cbEMR := circuitbreaker.NewGRPCBreaker("emr-service")
	cbRawatJalan := circuitbreaker.NewGRPCBreaker("rawat-jalan-service")
	cbPharmacy := circuitbreaker.NewGRPCBreaker("pharmacy-service")
	cbBilling := circuitbreaker.NewGRPCBreaker("billing-service")

	// ── gRPC Clients ──────────────────────────────────────────────────────────
	authClient := authpb.NewAuthServiceClient(authConn)
	patientClient := patientpb.NewPatientServiceClient(patientConn)
	regClient := regpb.NewRegistrationServiceClient(regConn)
	emrClient := emrpb.NewEMRServiceClient(emrConn)
	rawatJalanClient := rawatjalanpb.NewRawatJalanServiceClient(rawatJalanConn)
	pharmacyClient := pharmacypb.NewPharmacyServiceClient(pharmacyConn)
	billingClient := billingpb.NewBillingServiceClient(billingConn)

	// ── Ports (Port Interface = adapters wrap gRPC clients) ───────────────────
	svc := &ports.ServicePorts{
		Auth:         grpcadapter.NewAuthAdapter(authClient, cbAuth),
		Patient:      grpcadapter.NewPatientAdapter(patientClient, cbPatient),
		Registration: grpcadapter.NewRegistrationAdapter(regClient, cbReg),
		EMR:          grpcadapter.NewEMRAdapter(emrClient, cbEMR),
		RawatJalan:   grpcadapter.NewRawatJalanAdapter(rawatJalanClient, cbRawatJalan),
		Pharmacy:     grpcadapter.NewPharmacyAdapter(pharmacyClient, cbPharmacy),
		Billing:      grpcadapter.NewBillingAdapter(billingClient, cbBilling),
	}

	// ── Redis ─────────────────────────────────────────────────────────────────
	rdb := redis.NewClient(&redis.Options{
		Addr: mustEnv("REDIS_HOST", "localhost:6379"),
	})

	// ── Token Manager ─────────────────────────────────────────────────────────
	symmetricKey := mustEnv("JWT_SYMMETRIC_KEY", "59454c4c4f57205355424d4152494e452c20424c41434b2057495a4152445259")
	tokenManager, err := auth.NewTokenManager(symmetricKey)
	if err != nil {
		log.Fatalf("failed to init token manager: %v", err)
	}

	// ── Router ────────────────────────────────────────────────────────────────
	r := chi.NewRouter()
	r.Use(chimiddleware.RequestID)
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			w.Header().Set("X-Request-Id", chimiddleware.GetReqID(req.Context()))
			next.ServeHTTP(w, req)
		})
	})
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.Timeout(120 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"https://*", "http://*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Request-ID", "X-Trace-ID"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	r.Use(simrsmiddleware.TraceIDMiddleware)
	r.Use(simrsmiddleware.PrometheusMiddleware)
	rateLimiter := simrsmiddleware.NewRateLimiter(60, 120)
	r.Use(rateLimiter.Middleware())

	r.Handle("/metrics", promhttp.Handler())

	// ── Handlers ──────────────────────────────────────────────────────────────
	authHandler := handlers.NewAuthHandler(svc)
	adminHandler := handlers.NewAdminHandler(svc, handlers.GRPCConns{
		Auth:         authConn,
		Patient:      patientConn,
		Registration: regConn,
		EMR:          emrConn,
		Pharmacy:     pharmacyConn,
		Billing:      billingConn,
		RawatJalan:   rawatJalanConn,
	}, rdb)
	patientHandler := handlers.NewPatientHandler(svc)
	registrationHandler := handlers.NewRegistrationHandler(svc)
	billingHandler := handlers.NewBillingHandler(svc)
	masterHandler := handlers.NewMasterHandler(svc)
	rawatJalanHandler := handlers.NewRawatJalanHandler(svc)
	pharmacyHandler := handlers.NewPharmacyHandler(svc)

	// SSE & Queue Estimator (existing handlers, keep as-is)
	sseHandler := handlers.NewSSEHandler(rdb)
	estimatorHandler := handlers.NewQueueEstimatorHandler(emrClient, pharmacyClient)

	// ── API v1 Routes ─────────────────────────────────────────────────────────
	r.Route("/api/v1", func(r chi.Router) {
		// Public health check
		r.Get("/health", func(w http.ResponseWriter, req *http.Request) {
			response.JSON(w, http.StatusOK, response.SuccessResponse{
				RequestID: req.Header.Get("X-Request-ID"),
				TraceID:   req.Header.Get("X-Trace-ID"),
				Success:   true,
				Message:   "API Gateway is healthy and running",
				Data:      map[string]string{"status": "ok"},
			})
		})

		// Swagger UI
		fs := http.FileServer(http.Dir("./docs/swagger"))
		r.Handle("/swagger/*", http.StripPrefix("/api/v1/swagger/", fs))

		// SSE & Queue estimator (public — no auth required)
		r.Get("/queue/clinic/stream", sseHandler.StreamClinicQueue)
		r.Get("/queue/pharmacy/stream", sseHandler.StreamPharmacyQueue)
		r.Get("/queue/clinic/estimate", estimatorHandler.EstimateClinicWaitTime)
		r.Get("/queue/pharmacy/estimate", estimatorHandler.EstimatePharmacyWaitTime)

		// Public auth endpoints
		authHandler.RegisterPublic(r)

		// ── Authenticated routes ──────────────────────────────────────────────
		r.Group(func(r chi.Router) {
			r.Use(middleware.AuthMiddleware(tokenManager))

			// Basic System Health for all authenticated users (Admission Dashboard, etc.)
			r.Get("/system/health/basic", adminHandler.BasicHealth)

			// Admin & super_admin only
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("admin", "super_admin"))
				adminHandler.Register(r)
			})

			// Shared master data (all authenticated roles)
			masterHandler.Register(r)

			// Patient: admin, perawat, admisi
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("admin", "perawat", "admisi"))
				patientHandler.Register(r)
			})

			// Registration / Admisi dashboard: admin, admisi, perawat, dokter, kasir
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("admin", "admisi", "perawat", "dokter", "kasir"))
				registrationHandler.Register(r)
			})

			// Billing / Kasir: admin, kasir
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("admin", "kasir"))
				billingHandler.Register(r)
			})

			// EMR (dokter, perawat, rekam_medis)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("dokter", "perawat", "rekam_medis"))
				rawatJalanHandler.RegisterEMR(r)
			})

			// EMR KBM Verify (dokter, admin, rekam_medis)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("dokter", "admin", "rekam_medis"))
				rawatJalanHandler.RegisterEMRVerify(r)
			})

			// Rawat Jalan (dokter, perawat, admin, super_admin)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("dokter", "perawat", "admin", "super_admin"))
				rawatJalanHandler.RegisterRawatJalan(r)
			})

			// Rekam Medis (rekam_medis, admin, super_admin, dokter)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("rekam_medis", "admin", "super_admin", "dokter"))
				rawatJalanHandler.RegisterRekamMedis(r)
			})

			// Pharmacy (asisten_apoteker, admin)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("asisten_apoteker", "admin"))
				pharmacyHandler.Register(r)
			})
		})
	})


	// ── Server Startup ────────────────────────────────────────────────────────
	port := mustEnv("PORT", "8080")
	srv := &http.Server{
		Addr:         "0.0.0.0:" + port,
		Handler:      r,
		ReadTimeout:  120 * time.Second,
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	ctx, cancel := shutdown.WaitForSignal()
	defer cancel()

	go func() {
		slog.Info("Starting API Gateway", "port", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("API Gateway failed to start: %v", err)
		}
	}()

	// Diagnostic: list available Gemini models at startup
	go logGeminiModels()

	<-ctx.Done()
	slog.Info("Gracefully stopping API Gateway...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), shutdown.GracefulTimeout)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("API Gateway forced to shutdown", "error", err)
	}
	slog.Info("API Gateway stopped.")
}

// logGeminiModels logs available Gemini models for diagnostics at startup.
func logGeminiModels() {
	ctx := context.Background()
	client, err := genai.NewClient(ctx, nil)
	if err != nil {
		log.Printf("DIAG: Could not create genai client: %v", err)
		return
	}
	page, err := client.Models.List(ctx, nil)
	if err != nil {
		log.Printf("DIAG: Could not list genai models: %v", err)
		return
	}
	log.Println("DIAG: Available Gemini models:")
	for _, m := range page.Items {
		log.Printf("DIAG:   - %s", m.Name)
	}
	// Consume remaining pages to avoid resource leak
	for {
		_, err := page.Next(ctx)
		if err != nil {
			break
		}
	}
}
