package main

import (
	"context"
	"encoding/json"
	"log"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/aliube/go-micro-simrs-one/api-gateway/internal/middleware"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/auth"
	simrsmiddleware "github.com/aliube/go-micro-simrs-one/shared/pkg/middleware"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/response"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/shutdown"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/validator"
	authpb "github.com/aliube/go-micro-simrs-one/shared/proto/auth/v1"
	billingpb "github.com/aliube/go-micro-simrs-one/shared/proto/billing/v1"
	emrpb "github.com/aliube/go-micro-simrs-one/shared/proto/emr/v1"
	patientpb "github.com/aliube/go-micro-simrs-one/shared/proto/patient/v1"
	pharmacypb "github.com/aliube/go-micro-simrs-one/shared/proto/pharmacy/v1"
	regpb "github.com/aliube/go-micro-simrs-one/shared/proto/registration/v1"
)

func main() {
	r := chi.NewRouter()

	// 1. Basic Middlewares
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.Timeout(60 * time.Second))

	// 2. CORS
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"https://*", "http://*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Request-ID", "X-Trace-ID"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// 3. Custom Telemetry (trace_id) Middleware
	r.Use(simrsmiddleware.TraceIDMiddleware)

	// 4. Rate Limiter (60 req/s per IP, burst of 120)
	rateLimiter := simrsmiddleware.NewRateLimiter(60, 120)
	r.Use(rateLimiter.Middleware())

	// Connect to Auth gRPC
	authAddr := os.Getenv("AUTH_SERVICE_ADDR")
	if authAddr == "" {
		authAddr = "localhost:50051"
	}
	authConn, err := grpc.NewClient(authAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("failed to connect to auth service: %v", err)
	}
	defer authConn.Close()
	authClient := authpb.NewAuthServiceClient(authConn)

	// Connect to Patient gRPC
	patientAddr := os.Getenv("PATIENT_SERVICE_ADDR")
	if patientAddr == "" {
		patientAddr = "localhost:50052"
	}
	patientConn, err := grpc.NewClient(patientAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("failed to connect to patient service: %v", err)
	}
	defer patientConn.Close()
	patientClient := patientpb.NewPatientServiceClient(patientConn)

	// Connect to Registration gRPC
	regAddr := os.Getenv("REGISTRATION_SERVICE_ADDR")
	if regAddr == "" {
		regAddr = "localhost:50053"
	}
	regConn, err := grpc.NewClient(regAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("failed to connect to registration service: %v", err)
	}
	defer regConn.Close()
	regClient := regpb.NewRegistrationServiceClient(regConn)

	// Connect to EMR gRPC
	emrAddr := os.Getenv("EMR_SERVICE_ADDR")
	if emrAddr == "" {
		emrAddr = "localhost:50054"
	}
	emrConn, err := grpc.NewClient(emrAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("failed to connect to emr service: %v", err)
	}
	defer emrConn.Close()
	emrClient := emrpb.NewEMRServiceClient(emrConn)

	// Connect to Pharmacy gRPC
	pharmacyAddr := os.Getenv("PHARMACY_SERVICE_ADDR")
	if pharmacyAddr == "" {
		pharmacyAddr = "localhost:50055"
	}
	pharmacyConn, err := grpc.NewClient(pharmacyAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("failed to connect to pharmacy service: %v", err)
	}
	defer pharmacyConn.Close()
	pharmacyClient := pharmacypb.NewPharmacyServiceClient(pharmacyConn)

	// Connect to Billing gRPC
	billingAddr := os.Getenv("BILLING_SERVICE_ADDR")
	if billingAddr == "" {
		billingAddr = "localhost:50056"
	}
	billingConn, err := grpc.NewClient(billingAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("failed to connect to billing service: %v", err)
	}
	defer billingConn.Close()
	billingClient := billingpb.NewBillingServiceClient(billingConn)

	// 4. Init Token Manager for Middleware
	symmetricKey := "59454c4c4f57205355424d4152494e452c20424c41434b2057495a4152445259"
	tokenManager, err := auth.NewTokenManager(symmetricKey)
	if err != nil {
		log.Fatalf("failed to init token manager: %v", err)
	}

	// 5. Init Redis Client (for Idempotency)
	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "localhost:6379"
	}
	rdb := redis.NewClient(&redis.Options{
		Addr: redisHost,
	})

	// API Routes
	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			response.JSON(w, http.StatusOK, response.SuccessResponse{
				RequestID: r.Header.Get("X-Request-ID"),
				TraceID:   r.Header.Get("X-Trace-ID"), // Set by Telemetry Middleware
				Success:   true,
				Message:   "API Gateway is healthy and running",
				Data:      map[string]string{"status": "ok"},
			})
		})

		// Swagger UI (serving static files from docs/swagger)
		fs := http.FileServer(http.Dir("./docs/swagger"))
		r.Handle("/swagger/*", http.StripPrefix("/api/v1/swagger/", fs))

		r.Post("/auth/login", func(w http.ResponseWriter, r *http.Request) {
			var req authpb.LoginRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
				return
			}
			// Input validation
			if err := validator.ValidateAll(map[string]func() error{
				"username": validator.NotEmpty(req.Username),
				"password": validator.MinLength(req.Password, 6),
			}); err != nil {
				response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
				return
			}
			res, err := authClient.Login(r.Context(), &req)
			if err != nil {
				response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: err.Error()})
				return
			}
			response.JSON(w, http.StatusOK, res)
		})

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.AuthMiddleware(tokenManager))
			r.Use(simrsmiddleware.IdempotencyMiddleware(rdb, 24*time.Hour))
			
			// Patient (Admin, Nurse)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("admin", "nurse"))
				r.Post("/patient/register", func(w http.ResponseWriter, req *http.Request) {
					var payload patientpb.RegisterPatientRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{
							Success: false,
							Message: err.Error(),
						})
						return
					}
					res, err := patientClient.RegisterPatient(req.Context(), &payload)
					if err != nil {
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{
							Success: false,
							Message: err.Error(),
						})
						return
					}
					response.JSON(w, http.StatusOK, res)
				})

				r.Get("/patient/{mrn}", func(w http.ResponseWriter, req *http.Request) {
					mrn := chi.URLParam(req, "mrn")
					res, err := patientClient.GetPatientByMRN(req.Context(), &patientpb.GetPatientByMRNRequest{Mrn: mrn})
					if err != nil {
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{
							Success: false,
							Message: err.Error(),
						})
						return
					}
					response.JSON(w, http.StatusOK, res)
				})
			})

			// Registration (Admin, Nurse)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("admin", "nurse"))
				r.Post("/registrations", func(w http.ResponseWriter, req *http.Request) {
					var payload regpb.RegisterEncounterRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{
							Success: false,
							Message: err.Error(),
						})
						return
					}
					res, err := regClient.RegisterEncounter(req.Context(), &payload)
					if err != nil {
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{
							Success: false,
							Message: err.Error(),
						})
						return
					}
					response.JSON(w, http.StatusOK, res)
				})
			})

			// EMR (Doctor, Nurse)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("doctor", "nurse"))
				r.Post("/emr/triage", func(w http.ResponseWriter, req *http.Request) {
					var payload emrpb.SubmitTriageRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := emrClient.SubmitTriage(req.Context(), &payload)
					if err != nil {
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					response.JSON(w, http.StatusOK, res)
				})

				r.Post("/emr/diagnosis", func(w http.ResponseWriter, req *http.Request) {
					var payload emrpb.AddDiagnosisRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := emrClient.AddDiagnosis(req.Context(), &payload)
					if err != nil {
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					response.JSON(w, http.StatusOK, res)
				})

				r.Post("/emr/actions", func(w http.ResponseWriter, req *http.Request) {
					var payload emrpb.AddMedicalActionRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := emrClient.AddMedicalAction(req.Context(), &payload)
					if err != nil {
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					response.JSON(w, http.StatusOK, res)
				})

				r.Get("/emr/record/{encounter_no}", func(w http.ResponseWriter, req *http.Request) {
					encounterNo := chi.URLParam(req, "encounter_no")
					res, err := emrClient.GetMedicalRecord(req.Context(), &emrpb.GetMedicalRecordRequest{EncounterNo: encounterNo})
					if err != nil {
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					response.JSON(w, http.StatusOK, res)
				})
			})

			// Pharmacy (Pharmacist, Admin)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("pharmacist", "admin"))
				r.Post("/pharmacy/prescriptions", func(w http.ResponseWriter, req *http.Request) {
					var payload pharmacypb.CreatePrescriptionRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := pharmacyClient.CreatePrescription(req.Context(), &payload)
					if err != nil {
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					response.JSON(w, http.StatusOK, res)
				})

				r.Post("/pharmacy/dispense", func(w http.ResponseWriter, req *http.Request) {
					var payload pharmacypb.DispensePrescriptionRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := pharmacyClient.DispensePrescription(req.Context(), &payload)
					if err != nil {
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					response.JSON(w, http.StatusOK, res)
				})
			})

			// Billing (Cashier, Admin)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("cashier", "admin"))
				r.Get("/billing/invoice/{encounter_no}", func(w http.ResponseWriter, req *http.Request) {
					encounterNo := chi.URLParam(req, "encounter_no")
					res, err := billingClient.GenerateInvoice(req.Context(), &billingpb.GenerateInvoiceRequest{EncounterNo: encounterNo})
					if err != nil {
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					response.JSON(w, http.StatusOK, res)
				})

				r.Post("/billing/pay", func(w http.ResponseWriter, req *http.Request) {
					var payload billingpb.PayInvoiceRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := billingClient.PayInvoice(req.Context(), &payload)
					if err != nil {
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					response.JSON(w, http.StatusOK, res)
				})
			})
		})
	})
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful Shutdown
	ctx, cancel := shutdown.WaitForSignal()
	defer cancel()

	go func() {
		slog.Info("Starting API Gateway", "port", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("API Gateway failed to start: %v", err)
		}
	}()

	<-ctx.Done()
	slog.Info("Gracefully stopping API Gateway...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), shutdown.GracefulTimeout)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("API Gateway forced to shutdown: %v", err)
	}
	slog.Info("API Gateway stopped.")
}
