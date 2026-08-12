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

	"github.com/aliube/go-micro-simrs-one/api-gateway/internal/handlers"
	"github.com/aliube/go-micro-simrs-one/api-gateway/internal/middleware"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/auth"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/circuitbreaker"
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
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Request-Id", chimiddleware.GetReqID(r.Context()))
			next.ServeHTTP(w, r)
		})
	})
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

	// Circuit Breakers — one per downstream service
	cbAuth := circuitbreaker.NewGRPCBreaker("auth-service")
	cbPatient := circuitbreaker.NewGRPCBreaker("patient-service")
	cbRegistration := circuitbreaker.NewGRPCBreaker("registration-service")
	cbEMR := circuitbreaker.NewGRPCBreaker("emr-service")
	cbPharmacy := circuitbreaker.NewGRPCBreaker("pharmacy-service")
	cbBilling := circuitbreaker.NewGRPCBreaker("billing-service")

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

		// SSE Gateway Handler
		sseHandler := handlers.NewSSEHandler(rdb)
		r.Get("/queue/clinic/stream", sseHandler.StreamClinicQueue)
		r.Get("/queue/pharmacy/stream", sseHandler.StreamPharmacyQueue)

		// Queue Estimator REST Handler
		estimatorHandler := handlers.NewQueueEstimatorHandler(emrClient, pharmacyClient)
		r.Get("/queue/clinic/estimate", estimatorHandler.EstimateClinicWaitTime)
		r.Get("/queue/pharmacy/estimate", estimatorHandler.EstimatePharmacyWaitTime)


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
			res, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.LoginResponse, error) {
				return authClient.Login(r.Context(), &req)
			})
			if err != nil {
				response.HandleGRPCError(w, err)
				return
			}
			response.JSON(w, http.StatusOK, response.SuccessResponse{
				Success: true,
				Message: "Success",
				Data:    res,
			})
		})

		r.Post("/auth/refresh", func(w http.ResponseWriter, req *http.Request) {
			var payload struct {
				RefreshToken string `json:"refresh_token"`
			}
			if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
				response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
				return
			}
			if err := validator.ValidateAll(map[string]func() error{
				"refresh_token": validator.NotEmpty(payload.RefreshToken),
			}); err != nil {
				response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
				return
			}
			res, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.RefreshTokenResponse, error) {
				return authClient.RefreshToken(req.Context(), &authpb.RefreshTokenRequest{
					RefreshToken: payload.RefreshToken,
				})
			})
			if err != nil {
				response.HandleGRPCError(w, err)
				return
			}
			response.JSON(w, http.StatusOK, response.SuccessResponse{
				Success: true,
				Message: "Token refreshed successfully",
				Data:    res,
			})
		})

		r.Post("/auth/ocr-ktp", func(w http.ResponseWriter, req *http.Request) {
			var payload struct {
				Base64Image string `json:"base64_image"`
			}
			if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
				response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
				return
			}
			if payload.Base64Image == "" {
				response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: "base64_image is required"})
				return
			}
			res, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.ExtractKTPDataResponse, error) {
				return authClient.ExtractKTPData(req.Context(), &authpb.ExtractKTPDataRequest{
					Base64Image: payload.Base64Image,
				})
			})
			if err != nil {
				response.HandleGRPCError(w, err)
				return
			}
			response.JSON(w, http.StatusOK, response.SuccessResponse{
				Success: true,
				Message: "KTP data extracted successfully",
				Data:    res,
			})
		})

		r.Post("/auth/signup/patient", func(w http.ResponseWriter, req *http.Request) {
			var payload struct {
				Username string `json:"username"`
				Password string `json:"password"`
				Name     string `json:"name"`
				Nik      string `json:"nik"`
				Dob      string `json:"dob"`
			}
			if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
				response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
				return
			}
			if err := validator.ValidateAll(map[string]func() error{
				"username": validator.NotEmpty(payload.Username),
				"password": validator.MinLength(payload.Password, 6),
				"name":     validator.NotEmpty(payload.Name),
				"nik":      validator.NotEmpty(payload.Nik),
				"dob":      validator.IsDate(payload.Dob),
			}); err != nil {
				response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
				return
			}

			// 1. Create Auth User
			authRes, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.SignupResponse, error) {
				return authClient.Signup(req.Context(), &authpb.SignupRequest{
					Username: payload.Username,
					Password: payload.Password,
					Role:     "patient", // Hardcoded role
				})
			})
			if err != nil {
				response.HandleGRPCError(w, err)
				return
			}

			// 2. Register Patient
			patientRes, err := circuitbreaker.CallGRPC(cbPatient, func() (*patientpb.RegisterPatientResponse, error) {
				return patientClient.RegisterPatient(req.Context(), &patientpb.RegisterPatientRequest{
					Name:   payload.Name,
					Nik:    payload.Nik,
					Dob:    payload.Dob,
					UserId: authRes.UserId,
				})
			})
			if err != nil {
				// Note: in a real system we would rollback the auth user creation here using Saga/Outbox.
				response.HandleGRPCError(w, err)
				return
			}

			response.JSON(w, http.StatusOK, response.SuccessResponse{
				Success: true,
				Message: "Patient registered successfully",
				Data: map[string]interface{}{
					"user_id": authRes.UserId,
					"mrn":     patientRes.Mrn,
				},
			})
		})

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.AuthMiddleware(tokenManager))
			r.Use(simrsmiddleware.IdempotencyMiddleware(rdb, 24*time.Hour))
			
			// Auth (Admin only)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("admin"))
				r.Post("/auth/signup/staff", func(w http.ResponseWriter, req *http.Request) {
					var payload authpb.SignupRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					if err := validator.ValidateAll(map[string]func() error{
						"username": validator.NotEmpty(payload.Username),
						"password": validator.MinLength(payload.Password, 6),
						"role":     validator.NotEmpty(payload.Role),
					}); err != nil {
						response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.SignupResponse, error) {
						return authClient.Signup(req.Context(), &payload)
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{
				Success: true,
				Message: "Success",
				Data:    res,
			})
				})
			})
			
			// Patient (Admin, Nurse)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("admin", "nurse"))
				r.Post("/patient/register", func(w http.ResponseWriter, req *http.Request) {
					var payload patientpb.RegisterPatientRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					if err := validator.ValidateAll(map[string]func() error{
						"name": validator.NotEmpty(payload.Name),
						"nik":  validator.NotEmpty(payload.Nik),
						"dob":  validator.IsDate(payload.Dob),
					}); err != nil {
						response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := circuitbreaker.CallGRPC(cbPatient, func() (*patientpb.RegisterPatientResponse, error) {
					return patientClient.RegisterPatient(req.Context(), &payload)
				})
				if err != nil {
					response.HandleGRPCError(w, err)
					return
				}
				response.JSON(w, http.StatusOK, response.SuccessResponse{
				Success: true,
				Message: "Success",
				Data:    res,
			})
			})

				r.Get("/patient/{mrn}", func(w http.ResponseWriter, req *http.Request) {
					mrn := chi.URLParam(req, "mrn")
					res, err := circuitbreaker.CallGRPC(cbPatient, func() (*patientpb.GetPatientByMRNResponse, error) {
					return patientClient.GetPatientByMRN(req.Context(), &patientpb.GetPatientByMRNRequest{Mrn: mrn})
				})
				if err != nil {
					response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{
						Success: false,
						Message: err.Error(),
					})
					return
				}
				response.JSON(w, http.StatusOK, response.SuccessResponse{
				Success: true,
				Message: "Success",
				Data:    res,
			})
			})
			})

			// Registration (Admin, Nurse)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("admin", "nurse"))
				r.Post("/registrations", func(w http.ResponseWriter, req *http.Request) {
					var payload regpb.RegisterEncounterRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					if err := validator.ValidateAll(map[string]func() error{
						"mrn":             validator.NotEmpty(payload.Mrn),
						"department_code": validator.NotEmpty(payload.DepartmentCode),
						"doctor_id":       validator.NotEmpty(payload.DoctorId),
					}); err != nil {
						response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := circuitbreaker.CallGRPC(cbRegistration, func() (*regpb.RegisterEncounterResponse, error) {
					return regClient.RegisterEncounter(req.Context(), &payload)
				})
				if err != nil {
					response.HandleGRPCError(w, err)
					return
				}
				response.JSON(w, http.StatusOK, response.SuccessResponse{
				Success: true,
				Message: "Success",
				Data:    res,
			})
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
					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.SubmitTriageResponse, error) {
					return emrClient.SubmitTriage(req.Context(), &payload)
				})
				if err != nil {
					response.HandleGRPCError(w, err)
					return
				}
				response.JSON(w, http.StatusOK, response.SuccessResponse{
				Success: true,
				Message: "Success",
				Data:    res,
			})
			})

				r.Post("/emr/start", func(w http.ResponseWriter, req *http.Request) {
					var payload emrpb.StartEncounterRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					if err := validator.ValidateAll(map[string]func() error{
						"encounter_no": validator.NotEmpty(payload.EncounterNo),
					}); err != nil {
						response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.StartEncounterResponse, error) {
					return emrClient.StartEncounter(req.Context(), &payload)
				})
				if err != nil {
					response.HandleGRPCError(w, err)
					return
				}
				response.JSON(w, http.StatusOK, response.SuccessResponse{
				Success: true,
				Message: "Success",
				Data:    res,
			})
			})

				r.Post("/emr/diagnosis-kbm", func(w http.ResponseWriter, req *http.Request) {
					var payload emrpb.AddDiagnosisKBMRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					if err := validator.ValidateAll(map[string]func() error{
						"encounter_no": validator.NotEmpty(payload.EncounterNo),
						"kbm_code":     validator.NotEmpty(payload.KbmCode),
					}); err != nil {
						response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.AddDiagnosisKBMResponse, error) {
					return emrClient.AddDiagnosisKBM(req.Context(), &payload)
				})
				if err != nil {
					response.HandleGRPCError(w, err)
					return
				}
				response.JSON(w, http.StatusOK, response.SuccessResponse{
				Success: true,
				Message: "Success",
				Data:    res,
			})
			})

				r.Post("/emr/actions", func(w http.ResponseWriter, req *http.Request) {
					var payload emrpb.AddMedicalActionRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.AddMedicalActionResponse, error) {
					return emrClient.AddMedicalAction(req.Context(), &payload)
				})
				if err != nil {
					response.HandleGRPCError(w, err)
					return
				}
				response.JSON(w, http.StatusOK, response.SuccessResponse{
				Success: true,
				Message: "Success",
				Data:    res,
			})
			})

				r.Get("/emr/record/{encounter_no}", func(w http.ResponseWriter, req *http.Request) {
					encounterNo := chi.URLParam(req, "encounter_no")
					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.GetMedicalRecordResponse, error) {
					return emrClient.GetMedicalRecord(req.Context(), &emrpb.GetMedicalRecordRequest{EncounterNo: encounterNo})
				})
				if err != nil {
					response.HandleGRPCError(w, err)
					return
				}
				response.JSON(w, http.StatusOK, response.SuccessResponse{
				Success: true,
				Message: "Success",
				Data:    res,
			})
			})
			})

			// KBM (Doctor, Nurse, Medical Records, Admin)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("doctor", "nurse", "medical_records", "admin"))
				r.Get("/emr/kbm/search", func(w http.ResponseWriter, req *http.Request) {
					query := req.URL.Query().Get("q")
					deptCode := req.URL.Query().Get("dept_code")
					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.SearchKBMResponse, error) {
						return emrClient.SearchKBM(req.Context(), &emrpb.SearchKBMRequest{
							Query:          query,
							DepartmentCode: deptCode,
							Limit:          20,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{
				Success: true,
				Message: "Success",
				Data:    res,
			})
				})

				r.Get("/emr/kbm/{code}", func(w http.ResponseWriter, req *http.Request) {
					code := chi.URLParam(req, "code")
					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.GetKBMDetailResponse, error) {
						return emrClient.GetKBMDetail(req.Context(), &emrpb.GetKBMDetailRequest{KbmCode: code})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{
				Success: true,
				Message: "Success",
				Data:    res,
			})
				})
			})

			// EMR (Medical Records)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("medical_records", "admin"))
				r.Post("/emr/verify-icd10", func(w http.ResponseWriter, req *http.Request) {
					var payload emrpb.VerifyICD10MappingRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.VerifyICD10MappingResponse, error) {
						return emrClient.VerifyICD10Mapping(req.Context(), &payload)
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{
				Success: true,
				Message: "Success",
				Data:    res,
			})
				})

				r.Get("/emr/pending-icd10", func(w http.ResponseWriter, req *http.Request) {
					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.ListPendingICD10VerificationsResponse, error) {
						return emrClient.ListPendingICD10Verifications(req.Context(), &emrpb.ListPendingICD10VerificationsRequest{Limit: 50})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{
				Success: true,
				Message: "Success",
				Data:    res,
			})
				})

				r.Get("/emr/kbm/{code}/icd10-suggestions", func(w http.ResponseWriter, req *http.Request) {
					code := chi.URLParam(req, "code")
					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.GetICD10SuggestionsForKBMResponse, error) {
						return emrClient.GetICD10SuggestionsForKBM(req.Context(), &emrpb.GetICD10SuggestionsForKBMRequest{KbmCode: code})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{
				Success: true,
				Message: "Success",
				Data:    res,
			})
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
					if err := validator.ValidateAll(map[string]func() error{
						"encounter_no": validator.NotEmpty(payload.EncounterNo),
					}); err != nil {
						response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := circuitbreaker.CallGRPC(cbPharmacy, func() (*pharmacypb.CreatePrescriptionResponse, error) {
					return pharmacyClient.CreatePrescription(req.Context(), &payload)
				})
				if err != nil {
					response.HandleGRPCError(w, err)
					return
				}
				response.JSON(w, http.StatusOK, response.SuccessResponse{
				Success: true,
				Message: "Success",
				Data:    res,
			})
			})

				r.Post("/pharmacy/dispense", func(w http.ResponseWriter, req *http.Request) {
					var payload pharmacypb.DispensePrescriptionRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := circuitbreaker.CallGRPC(cbPharmacy, func() (*pharmacypb.DispensePrescriptionResponse, error) {
					return pharmacyClient.DispensePrescription(req.Context(), &payload)
				})
				if err != nil {
					response.HandleGRPCError(w, err)
					return
				}
				response.JSON(w, http.StatusOK, response.SuccessResponse{
				Success: true,
				Message: "Success",
				Data:    res,
			})
			})
			})

			// Billing (Cashier, Admin)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("cashier", "admin"))
				r.Get("/billing/invoice/{encounter_no}", func(w http.ResponseWriter, req *http.Request) {
					encounterNo := chi.URLParam(req, "encounter_no")
					res, err := circuitbreaker.CallGRPC(cbBilling, func() (*billingpb.GenerateInvoiceResponse, error) {
					return billingClient.GenerateInvoice(req.Context(), &billingpb.GenerateInvoiceRequest{EncounterNo: encounterNo})
				})
				if err != nil {
					response.HandleGRPCError(w, err)
					return
				}
				response.JSON(w, http.StatusOK, response.SuccessResponse{
				Success: true,
				Message: "Success",
				Data:    res,
			})
			})

				r.Post("/billing/pay", func(w http.ResponseWriter, req *http.Request) {
					var payload billingpb.PayInvoiceRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					if err := validator.ValidateAll(map[string]func() error{
						"invoice_id": validator.NotEmpty(payload.InvoiceId),
					}); err != nil {
						response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := circuitbreaker.CallGRPC(cbBilling, func() (*billingpb.PayInvoiceResponse, error) {
					return billingClient.PayInvoice(req.Context(), &payload)
				})
				if err != nil {
					response.HandleGRPCError(w, err)
					return
				}
				response.JSON(w, http.StatusOK, response.SuccessResponse{
				Success: true,
				Message: "Success",
				Data:    res,
			})
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
		slog.Error("API Gateway forced to shutdown", "error", err)
	}
	slog.Info("API Gateway stopped.")
}
