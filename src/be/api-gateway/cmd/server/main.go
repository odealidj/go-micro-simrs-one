package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/redis/go-redis/v9"
	"google.golang.org/api/iterator"
	"google.golang.org/genai"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/status"

	"github.com/aliube/go-micro-simrs-one/api-gateway/internal/handlers"
	"github.com/aliube/go-micro-simrs-one/api-gateway/internal/middleware"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/auth"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/circuitbreaker"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/db"
	simrsmiddleware "github.com/aliube/go-micro-simrs-one/shared/pkg/middleware"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/response"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/shutdown"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/validator"
	authpb "github.com/aliube/go-micro-simrs-one/shared/proto/auth/v1"
	billingpb "github.com/aliube/go-micro-simrs-one/shared/proto/billing/v1"
	emrpb "github.com/aliube/go-micro-simrs-one/shared/proto/emr/v1"
	patientpb "github.com/aliube/go-micro-simrs-one/shared/proto/patient/v1"
	pharmacypb "github.com/aliube/go-micro-simrs-one/shared/proto/pharmacy/v1"
	rawatjalanpb "github.com/aliube/go-micro-simrs-one/shared/proto/rawat_jalan/v1"
	regpb "github.com/aliube/go-micro-simrs-one/shared/proto/registration/v1"
	"github.com/prometheus/client_golang/prometheus/promhttp"
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
	r.Use(chimiddleware.Timeout(120 * time.Second))

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

	// 4. Prometheus Metrics Middleware
	r.Use(simrsmiddleware.PrometheusMiddleware)

	// 5. Rate Limiter (60 req/s per IP, burst of 120)
	rateLimiter := simrsmiddleware.NewRateLimiter(60, 120)
	r.Use(rateLimiter.Middleware())

	// Expose Prometheus metrics endpoint
	r.Handle("/metrics", promhttp.Handler())

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

	// Connect to EMR / Medical Record gRPC
	emrAddr := os.Getenv("MEDICAL_RECORD_SERVICE_ADDR")
	if emrAddr == "" {
		emrAddr = os.Getenv("EMR_SERVICE_ADDR")
	}
	if emrAddr == "" {
		emrAddr = "localhost:50054"
	}
	emrConn, err := grpc.NewClient(emrAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("failed to connect to emr/medical-record service: %v", err)
	}
	defer emrConn.Close()
	emrClient := emrpb.NewEMRServiceClient(emrConn)
	medicalRecordClient := emrClient

	// Connect to Rawat Jalan gRPC
	rawatJalanAddr := os.Getenv("RAWAT_JALAN_SERVICE_ADDR")
	if rawatJalanAddr == "" {
		rawatJalanAddr = "localhost:50057"
	}
	rawatJalanConn, err := grpc.NewClient(rawatJalanAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("failed to connect to rawat-jalan service: %v", err)
	}
	defer rawatJalanConn.Close()
	rawatJalanClient := rawatjalanpb.NewRawatJalanServiceClient(rawatJalanConn)

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
	cbMedicalRecord := circuitbreaker.NewGRPCBreaker("medical-record-service")
	cbRawatJalan := circuitbreaker.NewGRPCBreaker("rawat-jalan-service")
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

		r.Post("/auth/signup/staff", func(w http.ResponseWriter, req *http.Request) {
			var payload authpb.SignupRequest
			if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
				response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
				return
			}
			if err := validator.ValidateAll(map[string]func() error{
				"username":  validator.NotEmpty(payload.Username),
				"password":  validator.MinLength(payload.Password, 6),
				"email":     validator.NotEmpty(payload.Email),
				"full_name": validator.NotEmpty(payload.FullName),
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

		r.Post("/auth/signup/ocr-ktp", handleOCRKTP)

		r.Get("/master/label-profesi", func(w http.ResponseWriter, req *http.Request) {
			page, _ := strconv.Atoi(req.URL.Query().Get("page"))
			pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
			search := req.URL.Query().Get("search")

			res, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.ListLabelProfesiResponse, error) {
				return authClient.ListLabelProfesi(req.Context(), &authpb.ListLabelProfesiRequest{
					Page:     int32(page),
					PageSize: int32(pageSize),
					Search:   search,
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

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.AuthMiddleware(tokenManager))
			r.Use(simrsmiddleware.IdempotencyMiddleware(rdb, 24*time.Hour))

			// Basic Health Status for any authenticated user (e.g. Admission Dashboard)
			r.Get("/system/health/basic", func(w http.ResponseWriter, req *http.Request) {
				checkHealth := func(conn *grpc.ClientConn) string {
					client := grpc_health_v1.NewHealthClient(conn)
					ctx, cancel := context.WithTimeout(req.Context(), 2*time.Second)
					defer cancel()
					res, err := client.Check(ctx, &grpc_health_v1.HealthCheckRequest{})
					if err != nil {
						return "DOWN"
					}
					if res.Status == grpc_health_v1.HealthCheckResponse_SERVING {
						return "SERVING"
					}
					return res.Status.String()
				}

				statusData := map[string]interface{}{
					"api_gateway":          "SERVING",
					"patient_service":      checkHealth(patientConn),
					"registration_service": checkHealth(regConn),
					"billing_service":      checkHealth(billingConn),
				}
				response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: statusData})
			})

			// Admin Dashboard Routes
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("admin", "super_admin"))

				r.Get("/admin/system/health", func(w http.ResponseWriter, req *http.Request) {
					checkHealth := func(conn *grpc.ClientConn) string {
						client := grpc_health_v1.NewHealthClient(conn)
						ctx, cancel := context.WithTimeout(req.Context(), 2*time.Second)
						defer cancel()
						res, err := client.Check(ctx, &grpc_health_v1.HealthCheckRequest{})
						if err != nil {
							return "DOWN"
						}
						if res.Status == grpc_health_v1.HealthCheckResponse_SERVING {
							return "SERVING"
						}
						return res.Status.String()
					}

					redisStatus := "SERVING"
					ctx, cancel := context.WithTimeout(req.Context(), 2*time.Second)
					defer cancel()
					if err := rdb.Ping(ctx).Err(); err != nil {
						redisStatus = "DOWN"
					}

					statusData := map[string]interface{}{
						"api_gateway":          "SERVING",
						"auth_service":         checkHealth(authConn),
						"patient_service":      checkHealth(patientConn),
						"registration_service": checkHealth(regConn),
						"emr_service":          checkHealth(emrConn),
						"pharmacy_service":     checkHealth(pharmacyConn),
						"billing_service":      checkHealth(billingConn),
						"redis":                redisStatus,
					}

					var emrPending, emrFailed, pharmacyPending, pharmacyFailed int
					dbConn, err := db.ConnectPostgres("")
					if err == nil {
						defer dbConn.Close()
						dbConn.QueryRowContext(ctx, "SELECT COUNT(*) FROM emr.outbox WHERE status = 'pending'").Scan(&emrPending)
						dbConn.QueryRowContext(ctx, "SELECT COUNT(*) FROM emr.outbox WHERE status = 'failed'").Scan(&emrFailed)
						dbConn.QueryRowContext(ctx, "SELECT COUNT(*) FROM pharmacy.outbox WHERE status = 'pending'").Scan(&pharmacyPending)
						dbConn.QueryRowContext(ctx, "SELECT COUNT(*) FROM pharmacy.outbox WHERE status = 'failed'").Scan(&pharmacyFailed)
					}

					statusData["emr_outbox_unprocessed"] = emrPending
					statusData["emr_outbox_failed"] = emrFailed
					statusData["pharmacy_outbox_unprocessed"] = pharmacyPending
					statusData["pharmacy_outbox_failed"] = pharmacyFailed

					// Query Prometheus for Advanced Metrics
					queryPrometheus := func(query string) string {
						promURL := os.Getenv("PROMETHEUS_URL")
						if promURL == "" {
							promURL = "http://localhost:9090"
						}
						reqURL := promURL + "/api/v1/query?query=" + url.QueryEscape(query)
						ctx, cancel := context.WithTimeout(req.Context(), 2*time.Second)
						defer cancel()
						req, _ := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
						resp, err := http.DefaultClient.Do(req)
						if err != nil {
							return "N/A"
						}
						defer resp.Body.Close()
						var promRes struct {
							Data struct {
								Result []struct {
									Value []interface{} `json:"value"`
								} `json:"result"`
							} `json:"data"`
						}
						if err := json.NewDecoder(resp.Body).Decode(&promRes); err != nil || len(promRes.Data.Result) == 0 {
							return "N/A"
						}
						val := promRes.Data.Result[0].Value
						if len(val) > 1 {
							if strVal, ok := val[1].(string); ok {
								if parsed, err := strconv.ParseFloat(strVal, 64); err == nil {
									return strconv.FormatFloat(parsed, 'f', 2, 64)
								}
								return strVal
							}
						}
						return "N/A"
					}

					queryPrometheusList := func(query string) []map[string]string {
						promURL := os.Getenv("PROMETHEUS_URL")
						if promURL == "" {
							promURL = "http://localhost:9090"
						}
						reqURL := promURL + "/api/v1/query?query=" + url.QueryEscape(query)
						ctx, cancel := context.WithTimeout(req.Context(), 2*time.Second)
						defer cancel()
						req, _ := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
						resp, err := http.DefaultClient.Do(req)
						if err != nil {
							return nil
						}
						defer resp.Body.Close()
						var promRes struct {
							Data struct {
								Result []struct {
									Metric map[string]string `json:"metric"`
									Value  []interface{}     `json:"value"`
								} `json:"result"`
							} `json:"data"`
						}
						if err := json.NewDecoder(resp.Body).Decode(&promRes); err != nil {
							return nil
						}

						var out []map[string]string
						for _, r := range promRes.Data.Result {
							if len(r.Value) > 1 {
								if strVal, ok := r.Value[1].(string); ok {
									if parsed, err := strconv.ParseFloat(strVal, 64); err == nil {
										strVal = strconv.FormatFloat(parsed, 'f', 2, 64)
									}
									item := r.Metric
									if item == nil {
										item = make(map[string]string)
									}
									item["value"] = strVal
									out = append(out, item)
								}
							}
						}
						return out
					}

					statusData["sla_percent"] = queryPrometheus(`avg(avg_over_time(up[30d])) * 100`)
					statusData["cpu_usage_percent"] = queryPrometheus(`sum(rate(process_cpu_seconds_total[5m])) * 100`)
					statusData["exporter_cpu_percent"] = queryPrometheus(`sum(rate(process_cpu_seconds_total{job=~".*exporter.*|podman-exporter"}[5m])) * 100`)
					statusData["ram_usage_mb"] = queryPrometheus(`sum(process_resident_memory_bytes) / 1024 / 1024`)
					statusData["exporter_ram_mb"] = queryPrometheus(`sum(process_resident_memory_bytes{job=~".*exporter.*|podman-exporter"}) / 1024 / 1024`)
					statusData["http_error_rate"] = queryPrometheus(`sum(rate(http_requests_total{code=~"5.."}[5m])) or vector(0)`)

					statusData["microservices_cpu"] = queryPrometheusList(`sum by (job) (rate(process_cpu_seconds_total{job!~".*exporter.*|podman-exporter"}[5m])) * 100`)
					statusData["microservices_ram"] = queryPrometheusList(`sum by (job) (process_resident_memory_bytes{job!~".*exporter.*|podman-exporter"}) / 1024 / 1024`)

					// Internal Database Metrics
					statusData["redis_connected_clients"] = queryPrometheus(`redis_connected_clients or vector(0)`)
					statusData["redis_memory_used_mb"] = queryPrometheus(`redis_memory_used_bytes / 1024 / 1024 or vector(0)`)
					statusData["pg_active_connections"] = queryPrometheus(`sum(pg_stat_activity_count) or vector(0)`)
					statusData["pg_xact_commit"] = queryPrometheus(`sum(rate(pg_stat_database_xact_commit[5m])) or vector(0)`)

					// Hardware DB Metrics via prometheus-podman-exporter (kompatibel Podman & Docker)
					// Join podman_container_cpu/mem dengan podman_container_info untuk mendapat label `name`
					// Regex _postgres_|_redis_ memastikan hanya container DB asli (bukan exporter)
					statusData["db_hw_cpu"] = queryPrometheusList(`rate(podman_container_cpu_seconds_total[5m]) * 100 * on(id) group_left(name) podman_container_info{name=~".*(go-micro-simrs-one_postgres_|go-micro-simrs-one_redis_).*"}`)
					statusData["db_hw_ram"] = queryPrometheusList(`podman_container_mem_usage_bytes * on(id) group_left(name) podman_container_info{name=~".*(go-micro-simrs-one_postgres_|go-micro-simrs-one_redis_).*"} / 1024 / 1024`)

					response.JSON(w, http.StatusOK, response.SuccessResponse{
						Success: true,
						Message: "System health check completed",
						Data:    statusData,
					})
				})

				r.Get("/admin/system/master-metrics", func(w http.ResponseWriter, req *http.Request) {
					ctx, cancel := context.WithTimeout(req.Context(), 5*time.Second)
					defer cancel()

					metricsData := map[string]interface{}{
						"total_kbm":       0,
						"total_icd10":     0,
						"total_tindakan":  0,
						"total_obat":      0,
						"unmapped_kbm":    0,
						"active_users":    0,
						"today_encounter": 0,
					}

					dbConn, err := db.ConnectPostgres("")
					if err == nil {
						defer dbConn.Close()

						var totalKbm, totalIcd10, totalTindakan, unmappedKbm, totalObat, activeUsers, todayEncounter int

						// EMR Schema Master Data
						dbConn.QueryRowContext(ctx, "SELECT COUNT(*) FROM emr.kbm_catalog").Scan(&totalKbm)
						dbConn.QueryRowContext(ctx, "SELECT COUNT(*) FROM emr.icd10_catalog").Scan(&totalIcd10)
						dbConn.QueryRowContext(ctx, "SELECT COUNT(*) FROM emr.master_tindakan").Scan(&totalTindakan)

						// KBM Unmapped (Data Integrity)
						dbConn.QueryRowContext(ctx, "SELECT COUNT(*) FROM emr.kbm_catalog WHERE kbm_code NOT IN (SELECT kbm_code FROM emr.kbm_icd10_mappings)").Scan(&unmappedKbm)

						// Pharmacy Schema Master Data
						dbConn.QueryRowContext(ctx, "SELECT COUNT(*) FROM pharmacy.inventory").Scan(&totalObat)

						// Auth Schema (Active Users)
						dbConn.QueryRowContext(ctx, "SELECT COUNT(*) FROM auth.users WHERE status = 'ACTIVE'").Scan(&activeUsers)

						// Registration Schema (Today's Encounters)
						dbConn.QueryRowContext(ctx, "SELECT COUNT(*) FROM registration.encounters WHERE DATE(created_at) = CURRENT_DATE").Scan(&todayEncounter)

						type Breakdown struct {
							Label string `json:"label"`
							Count int    `json:"count"`
						}

						getBreakdown := func(query string) []Breakdown {
							rows, err := dbConn.QueryContext(ctx, query)
							var res []Breakdown
							if err != nil {
								return res
							}
							defer rows.Close()
							for rows.Next() {
								var b Breakdown
								if err := rows.Scan(&b.Label, &b.Count); err == nil {
									res = append(res, b)
								}
							}
							return res
						}

						metricsData["total_kbm"] = totalKbm
						metricsData["total_icd10"] = totalIcd10
						metricsData["total_tindakan"] = totalTindakan
						metricsData["unmapped_kbm"] = unmappedKbm
						metricsData["total_obat"] = totalObat
						metricsData["active_users"] = activeUsers
						metricsData["today_encounter"] = todayEncounter

						// Master Data Breakdowns
						metricsData["kbm_breakdown"] = getBreakdown("SELECT polyclinic_code, COUNT(*) FROM emr.kbm_polyclinic_mappings GROUP BY polyclinic_code")
						metricsData["icd10_breakdown"] = getBreakdown("SELECT polyclinic_code, COUNT(*) FROM emr.icd10_polyclinic_mappings GROUP BY polyclinic_code")
						metricsData["tindakan_breakdown"] = getBreakdown("SELECT polyclinic_code, COUNT(*) FROM emr.tindakan_polyclinic_mappings GROUP BY polyclinic_code")

						metricsData["dokter_breakdown"] = getBreakdown("SELECT poli_code, COUNT(*) FROM auth.mapping_dokter_poli WHERE deleted_dt IS NULL AND CURRENT_DATE <= end_date GROUP BY poli_code")
						metricsData["perawat_breakdown"] = getBreakdown("SELECT poli_code, COUNT(*) FROM auth.mapping_perawat_poli WHERE deleted_dt IS NULL AND CURRENT_DATE <= end_date GROUP BY poli_code")

						// User Demographics
						metricsData["role_demographics"] = getBreakdown("SELECT role, COUNT(*) FROM auth.users GROUP BY role")

						// Encounters Trend (Last 7 Days)
						type Trend struct {
							Date  string `json:"date"`
							Count int    `json:"count"`
						}
						var encounterTrend []Trend
						rows, err := dbConn.QueryContext(ctx, "SELECT TO_CHAR(DATE(created_at), 'YYYY-MM-DD'), COUNT(*) FROM registration.encounters GROUP BY DATE(created_at) ORDER BY DATE(created_at) DESC LIMIT 7")
						if err == nil {
							defer rows.Close()
							for rows.Next() {
								var t Trend
								if err := rows.Scan(&t.Date, &t.Count); err == nil {
									encounterTrend = append(encounterTrend, t)
								}
							}
							// Reverse to make it chronological
							for i, j := 0, len(encounterTrend)-1; i < j; i, j = i+1, j-1 {
								encounterTrend[i], encounterTrend[j] = encounterTrend[j], encounterTrend[i]
							}
						}
						metricsData["encounters_trend"] = encounterTrend

						// Upcoming Expirations (< 30 days)
						type Expiration struct {
							Name     string `json:"name"`
							Type     string `json:"type"` // Dokter / Perawat
							Poli     string `json:"poli"`
							EndDate  string `json:"end_date"`
							DaysLeft int    `json:"days_left"`
						}
						var expirations []Expiration

						// Dokter Expirations
						rowsD, errD := dbConn.QueryContext(ctx, `
							SELECT u.username, m.poli_code, TO_CHAR(m.end_date, 'YYYY-MM-DD'), (m.end_date - CURRENT_DATE) as days_left
							FROM auth.mapping_dokter_poli m
							JOIN auth.profil_dokter p ON m.dokter_id = p.id
							JOIN auth.users u ON p.user_id = u.id
							WHERE m.deleted_dt IS NULL AND (m.end_date - CURRENT_DATE) BETWEEN 0 AND 30
						`)
						if errD == nil {
							defer rowsD.Close()
							for rowsD.Next() {
								var e Expiration
								e.Type = "Dokter"
								if err := rowsD.Scan(&e.Name, &e.Poli, &e.EndDate, &e.DaysLeft); err == nil {
									expirations = append(expirations, e)
								}
							}
						}

						// Perawat Expirations
						rowsP, errP := dbConn.QueryContext(ctx, `
							SELECT u.username, m.poli_code, TO_CHAR(m.end_date, 'YYYY-MM-DD'), (m.end_date - CURRENT_DATE) as days_left
							FROM auth.mapping_perawat_poli m
							JOIN auth.profil_perawat p ON m.perawat_id = p.id
							JOIN auth.users u ON p.user_id = u.id
							WHERE m.deleted_dt IS NULL AND (m.end_date - CURRENT_DATE) BETWEEN 0 AND 30
						`)
						if errP == nil {
							defer rowsP.Close()
							for rowsP.Next() {
								var e Expiration
								e.Type = "Perawat"
								if err := rowsP.Scan(&e.Name, &e.Poli, &e.EndDate, &e.DaysLeft); err == nil {
									expirations = append(expirations, e)
								}
							}
						}
						metricsData["upcoming_expirations"] = expirations
					}

					response.JSON(w, http.StatusOK, response.SuccessResponse{
						Success: true,
						Message: "Master Data Metrics fetched",
						Data:    metricsData,
					})
				})

				r.Get("/admin/users", func(w http.ResponseWriter, req *http.Request) {
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					if page <= 0 {
						page = 1
					}
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					if pageSize <= 0 {
						pageSize = 50
					}
					statusFilter := req.URL.Query().Get("status")
					searchQuery := req.URL.Query().Get("search")

					res, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.ListUsersResponse, error) {
						return authClient.ListUsers(req.Context(), &authpb.ListUsersRequest{
							Page:         int32(page),
							PageSize:     int32(pageSize),
							StatusFilter: statusFilter,
							Search:       searchQuery,
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

				r.Put("/admin/users/{user_id}/status", func(w http.ResponseWriter, req *http.Request) {
					userID := chi.URLParam(req, "user_id")
					var payload struct {
						Status string `json:"status"`
						Role   string `json:"role"`
					}
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.UpdateUserStatusResponse, error) {
						return authClient.UpdateUserStatus(req.Context(), &authpb.UpdateUserStatusRequest{
							UserId: userID,
							Status: payload.Status,
							Role:   payload.Role,
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

				r.Delete("/admin/users/{user_id}", func(w http.ResponseWriter, req *http.Request) {
					userID := chi.URLParam(req, "user_id")
					// Use claims from token to get current admin ID (Assuming token manager sets it in context, but let's just pass empty for now or extract it)
					deletedBy := ""

					res, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.DeleteUserResponse, error) {
						return authClient.DeleteUser(req.Context(), &authpb.DeleteUserRequest{
							UserId:    userID,
							DeletedBy: deletedBy,
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
			})

			// Master Data Routes (All authenticated users can read master data)
			r.Group(func(r chi.Router) {
				r.Get("/master/roles", func(w http.ResponseWriter, req *http.Request) {
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					search := req.URL.Query().Get("search")

					res, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.GetMasterRolesResponse, error) {
						return authClient.GetMasterRoles(req.Context(), &authpb.GetMasterRolesRequest{
							Page:     int32(page),
							PageSize: int32(pageSize),
							Search:   search,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					// Convert response into response.SuccessPaginatedResponse
					// Since we don't have a shared parser for pb objects to struct, we will just pass it to response.JSON
					// But we should use SuccessPaginatedResponse structure.
					meta := response.Meta{
						Page:       page,
						PageSize:   pageSize,
						TotalData:  int(res.TotalCount),
						TotalPages: (int(res.TotalCount) + pageSize - 1) / pageSize,
					}
					if meta.Page < 1 {
						meta.Page = 1
					}
					if meta.PageSize < 1 {
						meta.PageSize = 10
					}
					if meta.TotalPages == 0 {
						meta.TotalPages = 1
					}

					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{
						Success: true,
						Message: "Success",
						Data:    res.Data,
						Meta:    meta,
					})
				})

				r.Get("/master/doctors", func(w http.ResponseWriter, req *http.Request) {
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					if page < 1 {
						page = 1
					}
					if pageSize < 1 {
						pageSize = 10
					}
					search := req.URL.Query().Get("search")

					res, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.GetDoctorsResponse, error) {
						return authClient.GetDoctors(req.Context(), &authpb.GetDoctorsRequest{
							Page:     int32(page),
							PageSize: int32(pageSize),
							Search:   search,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					totalPages := (int(res.TotalCount) + pageSize - 1) / pageSize
					if totalPages < 1 {
						totalPages = 1
					}
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: totalPages}
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})

				r.Get("/master/nurses", func(w http.ResponseWriter, req *http.Request) {
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					if page < 1 {
						page = 1
					}
					if pageSize < 1 {
						pageSize = 10
					}
					search := req.URL.Query().Get("search")

					res, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.GetNursesResponse, error) {
						return authClient.GetNurses(req.Context(), &authpb.GetNursesRequest{
							Page:     int32(page),
							PageSize: int32(pageSize),
							Search:   search,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					totalPages := (int(res.TotalCount) + pageSize - 1) / pageSize
					if totalPages < 1 {
						totalPages = 1
					}
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: totalPages}
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})

				r.Post("/master/doctors/assign", func(w http.ResponseWriter, req *http.Request) {
					var payload struct {
						DokterID   string  `json:"dokter_id"`
						PoliCode   string  `json:"poli_code"`
						StartDate  string  `json:"start_date"`
						EndDate    string  `json:"end_date"`
						DaysOfWeek []int32 `json:"days_of_week"`
						ShiftStart string  `json:"shift_start"`
						ShiftEnd   string  `json:"shift_end"`
					}
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "invalid request body"})
						return
					}

					if payload.StartDate == "" || payload.EndDate == "" {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "start_date and end_date are required"})
						return
					}

					_, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.AssignDoctorPoliResponse, error) {
						return authClient.AssignDoctorPoli(req.Context(), &authpb.AssignDoctorPoliRequest{
							DokterId:   payload.DokterID,
							PoliCode:   payload.PoliCode,
							StartDate:  payload.StartDate,
							EndDate:    payload.EndDate,
							DaysOfWeek: payload.DaysOfWeek,
							ShiftStart: payload.ShiftStart,
							ShiftEnd:   payload.ShiftEnd,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Doctor assigned successfully"})
				})

				r.Post("/master/nurses/assign", func(w http.ResponseWriter, req *http.Request) {
					var payload struct {
						PerawatID  string  `json:"perawat_id"`
						PoliCode   string  `json:"poli_code"`
						StartDate  string  `json:"start_date"`
						EndDate    string  `json:"end_date"`
						DaysOfWeek []int32 `json:"days_of_week"`
						ShiftStart string  `json:"shift_start"`
						ShiftEnd   string  `json:"shift_end"`
					}
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "invalid request body"})
						return
					}

					if payload.StartDate == "" || payload.EndDate == "" {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "start_date and end_date are required"})
						return
					}

					_, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.AssignNursePoliResponse, error) {
						return authClient.AssignNursePoli(req.Context(), &authpb.AssignNursePoliRequest{
							PerawatId:  payload.PerawatID,
							PoliCode:   payload.PoliCode,
							StartDate:  payload.StartDate,
							EndDate:    payload.EndDate,
							DaysOfWeek: payload.DaysOfWeek,
							ShiftStart: payload.ShiftStart,
							ShiftEnd:   payload.ShiftEnd,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Nurse assigned successfully"})
				})

				r.Post("/master/doctors/unassign", func(w http.ResponseWriter, req *http.Request) {
					var payload struct {
						DokterID string `json:"dokter_id"`
						PoliCode string `json:"poli_code"`
					}
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "invalid request body"})
						return
					}
					if payload.DokterID == "" {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "dokter_id is required"})
						return
					}
					res, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.UnassignDoctorPoliResponse, error) {
						return authClient.UnassignDoctorPoli(req.Context(), &authpb.UnassignDoctorPoliRequest{
							DokterId: payload.DokterID,
							PoliCode: payload.PoliCode,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: res.Message})
				})

				r.Post("/master/nurses/unassign", func(w http.ResponseWriter, req *http.Request) {
					var payload struct {
						PerawatID string `json:"perawat_id"`
						PoliCode  string `json:"poli_code"`
					}
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "invalid request body"})
						return
					}
					if payload.PerawatID == "" {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "perawat_id is required"})
						return
					}
					res, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.UnassignNursePoliResponse, error) {
						return authClient.UnassignNursePoli(req.Context(), &authpb.UnassignNursePoliRequest{
							PerawatId: payload.PerawatID,
							PoliCode:  payload.PoliCode,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: res.Message})
				})

				// --- JADWAL PIKET / KHUSUS TEMPORER (SABTU, MINGGU & HARI LIBUR) ---
				r.Get("/master/jadwal-piket", func(w http.ResponseWriter, req *http.Request) {
					dbConn, err := db.ConnectPostgres("")
					if err != nil {
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "database connection failed"})
						return
					}
					defer dbConn.Close()

					dateFilter := req.URL.Query().Get("date")
					monthFilter := req.URL.Query().Get("month")
					poliFilter := req.URL.Query().Get("poli_code")

					query := `
						SELECT 
							j.id::text, j.poli_code, 
							COALESCE(p.name, j.poli_code) as poli_name,
							j.dokter_id::text, u_d.username as dokter_name, COALESCE(pd.spesialisasi, 'Dokter') as dokter_spesialisasi,
							COALESCE(j.perawat_id::text, '') as perawat_id, 
							COALESCE(u_p.username, '') as perawat_name,
							TO_CHAR(j.piket_date, 'YYYY-MM-DD') as piket_date,
							TO_CHAR(j.shift_start, 'HH24:MI') as shift_start,
							TO_CHAR(j.shift_end, 'HH24:MI') as shift_end,
							COALESCE(j.keterangan, '') as keterangan,
							j.created_at
						FROM auth.jadwal_piket_poli j
						LEFT JOIN rawat_jalan.polyclinics p ON j.poli_code = p.code
						JOIN auth.profil_dokter pd ON j.dokter_id = pd.id
						JOIN auth.users u_d ON pd.user_id = u_d.id
						LEFT JOIN auth.profil_perawat pp ON j.perawat_id = pp.id
						LEFT JOIN auth.users u_p ON pp.user_id = u_p.id
						WHERE 1=1
					`
					var args []interface{}
					argIdx := 1

					if dateFilter != "" {
						query += fmt.Sprintf(" AND j.piket_date = $%d::DATE", argIdx)
						args = append(args, dateFilter)
						argIdx++
					}
					if monthFilter != "" {
						query += fmt.Sprintf(" AND TO_CHAR(j.piket_date, 'YYYY-MM') = $%d", argIdx)
						args = append(args, monthFilter)
						argIdx++
					}
					if poliFilter != "" {
						query += fmt.Sprintf(" AND j.poli_code = $%d", argIdx)
						args = append(args, poliFilter)
						argIdx++
					}
					query += " ORDER BY j.piket_date DESC, j.shift_start ASC"

					rows, err := dbConn.QueryContext(req.Context(), query, args...)
					if err != nil {
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "failed to query jadwal piket: " + err.Error()})
						return
					}
					defer rows.Close()

					type PiketItem struct {
						ID                 string    `json:"id"`
						PoliCode           string    `json:"poli_code"`
						PoliName           string    `json:"poli_name"`
						DokterID           string    `json:"dokter_id"`
						DokterName         string    `json:"dokter_name"`
						DokterSpesialisasi string    `json:"dokter_spesialisasi"`
						PerawatID          string    `json:"perawat_id"`
						PerawatName        string    `json:"perawat_name"`
						PiketDate          string    `json:"piket_date"`
						ShiftStart         string    `json:"shift_start"`
						ShiftEnd           string    `json:"shift_end"`
						Keterangan         string    `json:"keterangan"`
						CreatedAt          time.Time `json:"created_at"`
					}

					var list []PiketItem
					for rows.Next() {
						var it PiketItem
						if err := rows.Scan(
							&it.ID, &it.PoliCode, &it.PoliName,
							&it.DokterID, &it.DokterName, &it.DokterSpesialisasi,
							&it.PerawatID, &it.PerawatName,
							&it.PiketDate, &it.ShiftStart, &it.ShiftEnd,
							&it.Keterangan, &it.CreatedAt,
						); err == nil {
							list = append(list, it)
						}
					}
					if list == nil {
						list = []PiketItem{}
					}

					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Jadwal piket fetched", Data: list})
				})

				r.Post("/master/jadwal-piket", func(w http.ResponseWriter, req *http.Request) {
					var payload struct {
						PoliCode   string `json:"poli_code"`
						DokterID   string `json:"dokter_id"`
						PerawatID  string `json:"perawat_id"`
						PiketDate  string `json:"piket_date"`
						ShiftStart string `json:"shift_start"`
						ShiftEnd   string `json:"shift_end"`
						Keterangan string `json:"keterangan"`
					}
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "invalid request body"})
						return
					}

					if payload.PoliCode == "" || payload.DokterID == "" || payload.PiketDate == "" {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "poli_code, dokter_id, dan piket_date wajib diisi"})
						return
					}
					if payload.ShiftStart == "" {
						payload.ShiftStart = "08:00"
					}
					if payload.ShiftEnd == "" {
						payload.ShiftEnd = "14:00"
					}

					dbConn, err := db.ConnectPostgres("")
					if err != nil {
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "database connection failed"})
						return
					}
					defer dbConn.Close()

					userID, _ := req.Context().Value("user_id").(string)

					var insertedID string
					upsertQuery := `
						INSERT INTO auth.jadwal_piket_poli (
							poli_code, dokter_id, perawat_id, piket_date, shift_start, shift_end, keterangan, created_by
						) VALUES (
							$1, $2::uuid, NULLIF($3, '')::uuid, $4::DATE, $5::TIME, $6::TIME, $7, NULLIF($8, '')::uuid
						)
						ON CONFLICT (poli_code, piket_date) DO UPDATE SET
							dokter_id = EXCLUDED.dokter_id,
							perawat_id = EXCLUDED.perawat_id,
							shift_start = EXCLUDED.shift_start,
							shift_end = EXCLUDED.shift_end,
							keterangan = EXCLUDED.keterangan,
							created_at = CURRENT_TIMESTAMP
						RETURNING id::text
					`
					err = dbConn.QueryRowContext(req.Context(), upsertQuery,
						payload.PoliCode, payload.DokterID, payload.PerawatID, payload.PiketDate,
						payload.ShiftStart, payload.ShiftEnd, payload.Keterangan, userID,
					).Scan(&insertedID)
					if err != nil {
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "failed to save jadwal piket: " + err.Error()})
						return
					}

					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Jadwal piket berhasil disimpan", Data: map[string]string{"id": insertedID}})
				})

				r.Delete("/master/jadwal-piket/{id}", func(w http.ResponseWriter, req *http.Request) {
					piketID := chi.URLParam(req, "id")
					if piketID == "" {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "id is required"})
						return
					}

					dbConn, err := db.ConnectPostgres("")
					if err != nil {
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "database connection failed"})
						return
					}
					defer dbConn.Close()

					res, err := dbConn.ExecContext(req.Context(), "DELETE FROM auth.jadwal_piket_poli WHERE id = $1::uuid", piketID)
					if err != nil {
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "failed to delete jadwal piket: " + err.Error()})
						return
					}
					rowsAff, _ := res.RowsAffected()
					if rowsAff == 0 {
						response.JSON(w, http.StatusNotFound, response.ErrorResponse{Success: false, Message: "jadwal piket not found"})
						return
					}

					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Jadwal piket berhasil dibatalkan"})
				})

				r.Get("/master/polyclinics/{poli_code}/schedule", func(w http.ResponseWriter, req *http.Request) {
					poliCode := chi.URLParam(req, "poli_code")
					docRes, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.GetDoctorsByPoliResponse, error) {
						return authClient.GetDoctorsByPoli(req.Context(), &authpb.GetDoctorsByPoliRequest{
							PoliCode: poliCode,
							Page:     1,
							PageSize: 100,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}

					nurseRes, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.GetNursesByPoliResponse, error) {
						return authClient.GetNursesByPoli(req.Context(), &authpb.GetNursesByPoliRequest{
							PoliCode: poliCode,
							Page:     1,
							PageSize: 100,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}

					response.JSON(w, http.StatusOK, response.SuccessResponse{
						Success: true,
						Message: "Success",
						Data: map[string]interface{}{
							"poli_code": poliCode,
							"doctors":   docRes.Data,
							"nurses":    nurseRes.Data,
						},
					})
				})

				r.Put("/master/polyclinics/{poli_code}/schedule", func(w http.ResponseWriter, req *http.Request) {
					poliCode := chi.URLParam(req, "poli_code")
					var payload struct {
						Slots []struct {
							DayOfWeek int32  `json:"day_of_week"`
							DokterID  string `json:"dokter_id"`
							PerawatID string `json:"perawat_id"`
						} `json:"slots"`
					}
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "invalid request body"})
						return
					}

					var protoSlots []*authpb.DayScheduleSlot
					for _, s := range payload.Slots {
						protoSlots = append(protoSlots, &authpb.DayScheduleSlot{
							DayOfWeek: s.DayOfWeek,
							DokterId:  s.DokterID,
							PerawatId: s.PerawatID,
						})
					}

					res, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.UpdatePoliScheduleResponse, error) {
						return authClient.UpdatePoliSchedule(req.Context(), &authpb.UpdatePoliScheduleRequest{
							PoliCode: poliCode,
							Slots:    protoSlots,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: res.Message})
				})

				r.Get("/master/doctors/poli/{poli_code}", func(w http.ResponseWriter, req *http.Request) {
					poliCode := chi.URLParam(req, "poli_code")
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					if page < 1 {
						page = 1
					}
					if pageSize < 1 {
						pageSize = 10
					}
					search := req.URL.Query().Get("search")
					dayOfWeek, _ := strconv.Atoi(req.URL.Query().Get("day_of_week"))

					res, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.GetDoctorsByPoliResponse, error) {
						return authClient.GetDoctorsByPoli(req.Context(), &authpb.GetDoctorsByPoliRequest{
							PoliCode:  poliCode,
							Page:      int32(page),
							PageSize:  int32(pageSize),
							Search:    search,
							DayOfWeek: int32(dayOfWeek),
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					totalPages := (int(res.TotalCount) + pageSize - 1) / pageSize
					if totalPages < 1 {
						totalPages = 1
					}
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: totalPages}
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})

				r.Get("/master/nurses/poli/{poli_code}", func(w http.ResponseWriter, req *http.Request) {
					poliCode := chi.URLParam(req, "poli_code")
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					if page < 1 {
						page = 1
					}
					if pageSize < 1 {
						pageSize = 10
					}
					search := req.URL.Query().Get("search")
					dayOfWeek, _ := strconv.Atoi(req.URL.Query().Get("day_of_week"))

					res, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.GetNursesByPoliResponse, error) {
						return authClient.GetNursesByPoli(req.Context(), &authpb.GetNursesByPoliRequest{
							PoliCode:  poliCode,
							Page:      int32(page),
							PageSize:  int32(pageSize),
							Search:    search,
							DayOfWeek: int32(dayOfWeek),
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					totalPages := (int(res.TotalCount) + pageSize - 1) / pageSize
					if totalPages < 1 {
						totalPages = 1
					}
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: totalPages}
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})
				r.Get("/master/polyclinics", func(w http.ResponseWriter, req *http.Request) {
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					search := req.URL.Query().Get("search")

					if page < 1 {
						page = 1
					}
					if pageSize < 1 {
						pageSize = 10
					}

					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.GetPolyclinicsResponse, error) {
						return emrClient.GetPolyclinics(req.Context(), &emrpb.GetPolyclinicsRequest{
							Page:     int32(page),
							PageSize: int32(pageSize),
							Search:   search,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: (int(res.TotalCount) + pageSize - 1) / pageSize}
					if meta.TotalPages == 0 {
						meta.TotalPages = 1
					}
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})

				r.Get("/master/kbm", func(w http.ResponseWriter, req *http.Request) {
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					if page < 1 {
						page = 1
					}
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					if pageSize < 1 {
						pageSize = 10
					}
					searchName := req.URL.Query().Get("search_name")
					if searchName == "" {
						searchName = req.URL.Query().Get("search")
					}
					searchCode := req.URL.Query().Get("search_code")

					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.GetMasterKBMsResponse, error) {
						return emrClient.GetMasterKBMs(req.Context(), &emrpb.GetMasterKBMsRequest{
							Page:       int32(page),
							PageSize:   int32(pageSize),
							SearchName: searchName,
							SearchCode: searchCode,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					totalPages := (int(res.TotalCount) + pageSize - 1) / pageSize
					if totalPages < 1 {
						totalPages = 1
					}
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: totalPages}
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})

				r.Get("/master/kbm/poli/{poli_code}", func(w http.ResponseWriter, req *http.Request) {
					poliCode := chi.URLParam(req, "poli_code")
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					if page < 1 {
						page = 1
					}
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					if pageSize < 1 {
						pageSize = 10
					}
					searchName := req.URL.Query().Get("search_name")
					if searchName == "" {
						searchName = req.URL.Query().Get("search")
					}
					searchCode := req.URL.Query().Get("search_code")

					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.GetMasterKBMsByPoliResponse, error) {
						return emrClient.GetMasterKBMsByPoli(req.Context(), &emrpb.GetMasterKBMsByPoliRequest{
							PoliCode:   poliCode,
							Page:       int32(page),
							PageSize:   int32(pageSize),
							SearchName: searchName,
							SearchCode: searchCode,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					totalPages := (int(res.TotalCount) + pageSize - 1) / pageSize
					if totalPages < 1 {
						totalPages = 1
					}
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: totalPages}
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})

				r.Get("/master/tindakan", func(w http.ResponseWriter, req *http.Request) {
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					if page < 1 {
						page = 1
					}
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					if pageSize < 1 {
						pageSize = 10
					}
					searchName := req.URL.Query().Get("search_name")
					if searchName == "" {
						searchName = req.URL.Query().Get("search")
					}
					searchCode := req.URL.Query().Get("search_code")

					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.GetMasterTindakanResponse, error) {
						return emrClient.GetMasterTindakan(req.Context(), &emrpb.GetMasterTindakanRequest{
							Page:       int32(page),
							PageSize:   int32(pageSize),
							SearchName: searchName,
							SearchCode: searchCode,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					totalPages := (int(res.TotalCount) + pageSize - 1) / pageSize
					if totalPages < 1 {
						totalPages = 1
					}
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: totalPages}
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})

				r.Get("/master/tindakan/poli/{poli_code}", func(w http.ResponseWriter, req *http.Request) {
					poliCode := chi.URLParam(req, "poli_code")
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					if page < 1 {
						page = 1
					}
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					if pageSize < 1 {
						pageSize = 10
					}
					searchName := req.URL.Query().Get("search_name")
					if searchName == "" {
						searchName = req.URL.Query().Get("search")
					}
					searchCode := req.URL.Query().Get("search_code")

					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.GetMasterTindakanByPoliResponse, error) {
						return emrClient.GetMasterTindakanByPoli(req.Context(), &emrpb.GetMasterTindakanByPoliRequest{
							PoliCode:   poliCode,
							Page:       int32(page),
							PageSize:   int32(pageSize),
							SearchName: searchName,
							SearchCode: searchCode,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					totalPages := (int(res.TotalCount) + pageSize - 1) / pageSize
					if totalPages < 1 {
						totalPages = 1
					}
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: totalPages}
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})

				r.Get("/master/icd10", func(w http.ResponseWriter, req *http.Request) {
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					if page < 1 {
						page = 1
					}
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					if pageSize < 1 {
						pageSize = 10
					}
					searchName := req.URL.Query().Get("search_name")
					if searchName == "" {
						searchName = req.URL.Query().Get("search")
					}
					searchCode := req.URL.Query().Get("search_code")

					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.GetMasterICD10Response, error) {
						return emrClient.GetMasterICD10(req.Context(), &emrpb.GetMasterICD10Request{
							Page:       int32(page),
							PageSize:   int32(pageSize),
							SearchName: searchName,
							SearchCode: searchCode,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					totalPages := (int(res.TotalCount) + pageSize - 1) / pageSize
					if totalPages < 1 {
						totalPages = 1
					}
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: totalPages}
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})

				r.Get("/master/icd10/poli/{poli_code}", func(w http.ResponseWriter, req *http.Request) {
					poliCode := chi.URLParam(req, "poli_code")
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					if page < 1 {
						page = 1
					}
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					if pageSize < 1 {
						pageSize = 10
					}
					searchName := req.URL.Query().Get("search_name")
					if searchName == "" {
						searchName = req.URL.Query().Get("search")
					}
					searchCode := req.URL.Query().Get("search_code")

					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.GetMasterICD10ByPoliResponse, error) {
						return emrClient.GetMasterICD10ByPoli(req.Context(), &emrpb.GetMasterICD10ByPoliRequest{
							PoliCode:   poliCode,
							Page:       int32(page),
							PageSize:   int32(pageSize),
							SearchName: searchName,
							SearchCode: searchCode,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					totalPages := (int(res.TotalCount) + pageSize - 1) / pageSize
					if totalPages < 1 {
						totalPages = 1
					}
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: totalPages}
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})
				
				r.Get("/master/icd9", func(w http.ResponseWriter, req *http.Request) {
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					if page < 1 {
						page = 1
					}
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					if pageSize < 1 {
						pageSize = 10
					}
					search := req.URL.Query().Get("search")
					if search == "" {
						search = req.URL.Query().Get("search_name")
					}
					if search == "" {
						search = req.URL.Query().Get("search_code")
					}

					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.GetMasterICD9Response, error) {
						return emrClient.GetMasterICD9(req.Context(), &emrpb.GetMasterICD9Request{
							Offset:     int32((page - 1) * pageSize),
							Limit:      int32(pageSize),
							Search:     search,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					totalPages := (int(res.Total) + pageSize - 1) / pageSize
					if totalPages < 1 {
						totalPages = 1
					}
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.Total), TotalPages: totalPages}
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Items, Meta: meta})
				})

				r.Get("/master/tindakan/{code}/icd9-suggestions", func(w http.ResponseWriter, req *http.Request) {
					kodeTindakan := chi.URLParam(req, "code")

					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.GetICD9SuggestionsForTindakanResponse, error) {
						return emrClient.GetICD9SuggestionsForTindakan(req.Context(), &emrpb.GetICD9SuggestionsForTindakanRequest{
							KodeTindakan: kodeTindakan,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
				})

				r.Get("/master/snomed", func(w http.ResponseWriter, req *http.Request) {
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					if page < 1 {
						page = 1
					}
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					if pageSize < 1 {
						pageSize = 10
					}
					search := req.URL.Query().Get("search")
					if search == "" {
						search = req.URL.Query().Get("search_name")
					}
					if search == "" {
						search = req.URL.Query().Get("search_code")
					}
					semanticTag := req.URL.Query().Get("semantic_tag")

					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.GetMasterSNOMEDResponse, error) {
						return emrClient.GetMasterSNOMED(req.Context(), &emrpb.GetMasterSNOMEDRequest{
							Page:        int32(page),
							PageSize:    int32(pageSize),
							Search:      search,
							SemanticTag: semanticTag,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					totalPages := (int(res.TotalCount) + pageSize - 1) / pageSize
					if totalPages < 1 {
						totalPages = 1
					}
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: totalPages}
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})

				r.Get("/master/snomed/{concept_id}/mappings", func(w http.ResponseWriter, req *http.Request) {
					conceptID := chi.URLParam(req, "concept_id")

					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.GetSNOMEDMappingDetailsResponse, error) {
						return emrClient.GetSNOMEDMappingDetails(req.Context(), &emrpb.GetSNOMEDMappingDetailsRequest{
							ConceptId: conceptID,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
				})

				r.Get("/master/kbm/{code}/icd10-suggestions", func(w http.ResponseWriter, req *http.Request) {
					kbmCode := chi.URLParam(req, "code")

					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.GetICD10SuggestionsForKBMResponse, error) {
						return emrClient.GetICD10SuggestionsForKBM(req.Context(), &emrpb.GetICD10SuggestionsForKBMRequest{
							KbmCode: kbmCode,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
				})

				r.Get("/master/icd10/{code}/mappings", func(w http.ResponseWriter, req *http.Request) {
					code := chi.URLParam(req, "code")

					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.GetICD10MappingDetailsResponse, error) {
						return emrClient.GetICD10MappingDetails(req.Context(), &emrpb.GetICD10MappingDetailsRequest{
							Icd10Code: code,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
				})

				r.Get("/master/icd9/{code}/mappings", func(w http.ResponseWriter, req *http.Request) {
					code := chi.URLParam(req, "code")

					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.GetICD9MappingDetailsResponse, error) {
						return emrClient.GetICD9MappingDetails(req.Context(), &emrpb.GetICD9MappingDetailsRequest{
							Icd9Code: code,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
				})
				r.Get("/master/obat", func(w http.ResponseWriter, req *http.Request) {
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					searchName := req.URL.Query().Get("search_name")
					searchCode := req.URL.Query().Get("search_code")

					res, err := circuitbreaker.CallGRPC(cbPharmacy, func() (*pharmacypb.GetMasterObatResponse, error) {
						return pharmacyClient.GetMasterObat(req.Context(), &pharmacypb.GetMasterObatRequest{
							Page:       int32(page),
							PageSize:   int32(pageSize),
							SearchName: searchName,
							SearchCode: searchCode,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: (int(res.TotalCount) + pageSize - 1) / pageSize}
					if meta.Page < 1 {
						meta.Page = 1
					}
					if meta.PageSize < 1 {
						meta.PageSize = 10
					}
					if meta.TotalPages == 0 {
						meta.TotalPages = 1
					}
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})

				r.Get("/master/obat/poli/{poli_code}", func(w http.ResponseWriter, req *http.Request) {
					poliCode := chi.URLParam(req, "poli_code")
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					searchName := req.URL.Query().Get("search_name")
					searchCode := req.URL.Query().Get("search_code")

					res, err := circuitbreaker.CallGRPC(cbPharmacy, func() (*pharmacypb.GetMasterObatByPoliResponse, error) {
						return pharmacyClient.GetMasterObatByPoli(req.Context(), &pharmacypb.GetMasterObatByPoliRequest{
							PoliCode:   poliCode,
							Page:       int32(page),
							PageSize:   int32(pageSize),
							SearchName: searchName,
							SearchCode: searchCode,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: (int(res.TotalCount) + pageSize - 1) / pageSize}
					if meta.Page < 1 {
						meta.Page = 1
					}
					if meta.PageSize < 1 {
						meta.PageSize = 10
					}
					if meta.TotalPages == 0 {
						meta.TotalPages = 1
					}
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})

				r.Get("/master/obat/{item_code}/mappings", func(w http.ResponseWriter, req *http.Request) {
					itemCode := chi.URLParam(req, "item_code")
					res, err := circuitbreaker.CallGRPC(cbPharmacy, func() (*pharmacypb.GetObatMappingDetailsResponse, error) {
						return pharmacyClient.GetObatMappingDetails(req.Context(), &pharmacypb.GetObatMappingDetailsRequest{
							ItemCode: itemCode,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
				})

				r.Get("/master/kfa", func(w http.ResponseWriter, req *http.Request) {
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					search := req.URL.Query().Get("search")

					res, err := circuitbreaker.CallGRPC(cbPharmacy, func() (*pharmacypb.GetMasterKFAResponse, error) {
						return pharmacyClient.GetMasterKFA(req.Context(), &pharmacypb.GetMasterKFARequest{
							Page:     int32(page),
							PageSize: int32(pageSize),
							Search:   search,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: (int(res.TotalCount) + pageSize - 1) / pageSize}
					if meta.Page < 1 {
						meta.Page = 1
					}
					if meta.PageSize < 1 {
						meta.PageSize = 10
					}
					if meta.TotalPages == 0 {
						meta.TotalPages = 1
					}
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})

				r.Get("/master/dpho", func(w http.ResponseWriter, req *http.Request) {
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					search := req.URL.Query().Get("search")
					fornasStr := req.URL.Query().Get("is_fornas")
					prbStr := req.URL.Query().Get("is_prb")

					var isFornasPtr *bool
					if fornasStr != "" {
						val := fornasStr == "true"
						isFornasPtr = &val
					}
					var isPrbPtr *bool
					if prbStr != "" {
						val := prbStr == "true"
						isPrbPtr = &val
					}

					res, err := circuitbreaker.CallGRPC(cbPharmacy, func() (*pharmacypb.GetMasterDPHOResponse, error) {
						return pharmacyClient.GetMasterDPHO(req.Context(), &pharmacypb.GetMasterDPHORequest{
							Page:     int32(page),
							PageSize: int32(pageSize),
							Search:   search,
							IsFornas: isFornasPtr,
							IsPrb:    isPrbPtr,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: (int(res.TotalCount) + pageSize - 1) / pageSize}
					if meta.Page < 1 {
						meta.Page = 1
					}
					if meta.PageSize < 1 {
						meta.PageSize = 10
					}
					if meta.TotalPages == 0 {
						meta.TotalPages = 1
					}
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})
			})
			// Patient (Admin, Perawat, Admisi)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("admin", "perawat", "admisi"))

				r.Get("/patients", func(w http.ResponseWriter, req *http.Request) {
					search := req.URL.Query().Get("search")
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					if page <= 0 {
						page = 1
					}
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					if pageSize <= 0 {
						pageSize = 50
					}

					res, err := circuitbreaker.CallGRPC(cbPatient, func() (*patientpb.SearchPatientsResponse, error) {
						return patientClient.SearchPatients(req.Context(), &patientpb.SearchPatientsRequest{
							Page:     int32(page),
							PageSize: int32(pageSize),
							Search:   search,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}

					meta := response.Meta{
						Page:       page,
						PageSize:   pageSize,
						TotalData:  int(res.TotalCount),
						TotalPages: (int(res.TotalCount) + pageSize - 1) / pageSize,
					}
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Patients, Meta: meta})
				})

				// Static file server for patient photos
				// Use absolute or relative to working directory, we will use /tmp for now or similar, let's just use local relative
				// Or wait, let's just use a fixed local directory for simplicity
				os.MkdirAll("uploads/patients", 0755)
				r.Get("/uploads/patients/*", http.StripPrefix("/uploads/patients/", http.FileServer(http.Dir("uploads/patients"))).ServeHTTP)

				r.Post("/patient/upload-photo", func(w http.ResponseWriter, req *http.Request) {
					err := req.ParseMultipartForm(10 << 20) // 10MB
					if err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "Failed to parse form: " + err.Error()})
						return
					}
					file, handler, err := req.FormFile("photo")
					if err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "Failed to get photo: " + err.Error()})
						return
					}
					defer file.Close()

					ext := filepath.Ext(handler.Filename)
					filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
					dstPath := filepath.Join("uploads", "patients", filename)

					dst, err := os.Create(dstPath)
					if err != nil {
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "Failed to create file on server: " + err.Error()})
						return
					}
					defer dst.Close()

					if _, err := io.Copy(dst, file); err != nil {
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "Failed to save file on server: " + err.Error()})
						return
					}

					photoUrl := "/api/v1/uploads/patients/" + filename
					response.JSON(w, http.StatusOK, response.SuccessResponse{
						Success: true,
						Message: "Success",
						Data:    map[string]string{"photo_url": photoUrl},
					})
				})

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

					// 1. Create User in Auth Service
					authRes, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.RegisterPatientUserResponse, error) {
						return authClient.RegisterPatientUser(req.Context(), &authpb.RegisterPatientUserRequest{
							Username: payload.Nik,
							Password: payload.Dob,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}

					// 2. Set UserId and Create Patient
					payload.UserId = authRes.UserId
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

			// Registration (Admin, Perawat, Admisi, Dokter, Kasir)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("admin", "perawat", "admisi", "dokter", "kasir"))

				r.Post("/registrations/ocr-ktp", handleOCRKTP)

				r.Post("/registrations/new-patient", func(w http.ResponseWriter, req *http.Request) {
					type NewPatientRegistrationPayload struct {
						Name           string `json:"name"`
						Nik            string `json:"nik"`
						Dob            string `json:"dob"` // YYYY-MM-DD
						Gender         string `json:"gender"`
						BirthPlace     string `json:"birth_place"`
						Address        string `json:"address"`
						DepartmentCode string `json:"department_code"`
						DoctorId       string `json:"doctor_id"`
						PerawatId      string `json:"perawat_id"`
						Guarantor      string `json:"guarantor"` // Umum or BPJS
						Email          string `json:"email"`
					}

					var payload NewPatientRegistrationPayload
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}

					if err := validator.ValidateAll(map[string]func() error{
						"name":            validator.NotEmpty(payload.Name),
						"nik":             validator.NotEmpty(payload.Nik),
						"dob":             validator.IsDate(payload.Dob),
						"department_code": validator.NotEmpty(payload.DepartmentCode),
						"guarantor":       validator.NotEmpty(payload.Guarantor),
					}); err != nil {
						response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}

					// Validasi jadwal dokter hari ini (Prioritas 1: Piket, Prioritas 2: Jadwal Reguler)
					var piketDoctorID, piketNurseID string
					dbConnPiket, errPiket := db.ConnectPostgres("")
					if errPiket == nil {
						defer dbConnPiket.Close()
						_ = dbConnPiket.QueryRowContext(req.Context(), `
							SELECT dokter_id::text, COALESCE(perawat_id::text, '')
							FROM auth.jadwal_piket_poli
							WHERE poli_code = $1 AND piket_date = CURRENT_DATE
							LIMIT 1
						`, payload.DepartmentCode).Scan(&piketDoctorID, &piketNurseID)
					}

					todayWeekday := int32(time.Now().Weekday())
					if todayWeekday == 0 {
						todayWeekday = 7
					}

					if piketDoctorID != "" {
						// Ada dokter piket khusus hari ini!
						payload.DoctorId = piketDoctorID
						if payload.PerawatId == "" && piketNurseID != "" {
							payload.PerawatId = piketNurseID
						}
					} else {
						// Fallback ke jadwal reguler
						docRes, errDoc := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.GetDoctorsByPoliResponse, error) {
							return authClient.GetDoctorsByPoli(req.Context(), &authpb.GetDoctorsByPoliRequest{
								PoliCode:  payload.DepartmentCode,
								Page:      1,
								PageSize:  50,
								DayOfWeek: todayWeekday,
							})
						})
						if errDoc != nil || docRes == nil || len(docRes.Data) == 0 {
							response.JSON(w, http.StatusBadRequest, response.ErrorResponse{
								Success: false,
								Message: "Tidak ada jadwal dokter yang bertugas di poliklinik ini pada hari ini. Pendaftaran kunjungan tidak dapat diproses.",
							})
							return
						}

						if payload.DoctorId == "" {
							payload.DoctorId = docRes.Data[0].Id
						} else {
							doctorFound := false
							for _, d := range docRes.Data {
								if d.Id == payload.DoctorId {
									doctorFound = true
									break
								}
							}
							if !doctorFound {
								payload.DoctorId = docRes.Data[0].Id
							}
						}
					}

					// Auto-assign perawat dinas hari ini jika ada
					nurseRes, errNurse := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.GetNursesByPoliResponse, error) {
						return authClient.GetNursesByPoli(req.Context(), &authpb.GetNursesByPoliRequest{
							PoliCode:  payload.DepartmentCode,
							Page:      1,
							PageSize:  50,
							DayOfWeek: todayWeekday,
						})
					})
					if errNurse == nil && nurseRes != nil && len(nurseRes.Data) > 0 {
						if payload.PerawatId == "" {
							payload.PerawatId = nurseRes.Data[0].Id
						} else {
							nurseFound := false
							for _, n := range nurseRes.Data {
								if n.Id == payload.PerawatId {
									nurseFound = true
									break
								}
							}
							if !nurseFound {
								payload.PerawatId = nurseRes.Data[0].Id
							}
						}
					} else {
						payload.PerawatId = ""
					}

					// SAGA: 1. Create User in Auth Service
					authRes, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.RegisterPatientUserResponse, error) {
						return authClient.RegisterPatientUser(req.Context(), &authpb.RegisterPatientUserRequest{
							Username: payload.Nik,
							Password: payload.Dob,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}

					// SAGA: 2. Create Patient in Patient Service
					patientRes, err := circuitbreaker.CallGRPC(cbPatient, func() (*patientpb.RegisterPatientResponse, error) {
						return patientClient.RegisterPatient(req.Context(), &patientpb.RegisterPatientRequest{
							Name:       payload.Name,
							Nik:        payload.Nik,
							Dob:        payload.Dob,
							Gender:     payload.Gender,
							BirthPlace: payload.BirthPlace,
							Address:    payload.Address,
							Email:      payload.Email,
							UserId:     authRes.UserId,
						})
					})

					if err != nil {
						// ROLLBACK User
						log.Printf("SAGA: Rollback Auth User %s due to Patient creation failure", authRes.UserId)
						_, _ = circuitbreaker.CallGRPC(cbAuth, func() (*authpb.DeleteUserResponse, error) {
							return authClient.DeleteUser(context.Background(), &authpb.DeleteUserRequest{
								UserId:     authRes.UserId,
								HardDelete: true,
							})
						})
						response.HandleGRPCError(w, err)
						return
					}

					// SAGA: 3. Create Encounter in Registration Service
					regRes, err := circuitbreaker.CallGRPC(cbRegistration, func() (*regpb.RegisterEncounterResponse, error) {
						return regClient.RegisterEncounter(req.Context(), &regpb.RegisterEncounterRequest{
							Mrn:            patientRes.Mrn,
							DepartmentCode: payload.DepartmentCode,
							DoctorId:       payload.DoctorId,
							PerawatId:      payload.PerawatId,
							Guarantor:      payload.Guarantor,
						})
					})

					if err != nil {
						// ROLLBACK Patient
						log.Printf("SAGA: Rollback Patient %s due to Encounter creation failure", patientRes.Mrn)
						_, _ = circuitbreaker.CallGRPC(cbPatient, func() (*patientpb.DeletePatientResponse, error) {
							return patientClient.DeletePatient(context.Background(), &patientpb.DeletePatientRequest{
								Mrn: patientRes.Mrn,
							})
						})
						// ROLLBACK User
						log.Printf("SAGA: Rollback Auth User %s due to Encounter creation failure", authRes.UserId)
						_, _ = circuitbreaker.CallGRPC(cbAuth, func() (*authpb.DeleteUserResponse, error) {
							return authClient.DeleteUser(context.Background(), &authpb.DeleteUserRequest{
								UserId:     authRes.UserId,
								HardDelete: true,
							})
						})

						response.HandleGRPCError(w, err)
						return
					}

					if payload.Guarantor == "Umum" {
						fee := 150000.0
						if payload.DepartmentCode == "UMU" || payload.DepartmentCode == "01" || payload.DepartmentCode == "Poli Umum" || payload.DepartmentCode == "POLI_UMUM" {
							fee = 50000.0
						}

						_, errBilling := circuitbreaker.CallGRPC(cbBilling, func() (*billingpb.AddRegistrationFeeResponse, error) {
							return billingClient.AddRegistrationFee(req.Context(), &billingpb.AddRegistrationFeeRequest{
								EncounterNo:    regRes.EncounterNo,
								DepartmentCode: payload.DepartmentCode,
								Amount:         fee,
							})
						})

						if errBilling != nil {
							log.Printf("SAGA: Failed to add registration fee to billing: %v. Continuing since invoice can be recreated manually", errBilling)
							// We could choose to rollback here, but billing creation failure might just be logged and retried later.
						}
					}

					// Success!
					response.JSON(w, http.StatusOK, response.SuccessResponse{
						Success: true,
						Message: "Patient & Encounter created successfully",
						Data: map[string]interface{}{
							"mrn":          patientRes.Mrn,
							"encounter_no": regRes.EncounterNo,
						},
					})
				})

				r.Post("/registrations", func(w http.ResponseWriter, req *http.Request) {
					var payload regpb.RegisterEncounterRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					if err := validator.ValidateAll(map[string]func() error{
						"mrn":             validator.NotEmpty(payload.Mrn),
						"department_code": validator.NotEmpty(payload.DepartmentCode),
						"guarantor":       validator.NotEmpty(payload.Guarantor),
					}); err != nil {
						response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}

					// Validasi jadwal dokter hari ini (Prioritas 1: Piket, Prioritas 2: Jadwal Reguler)
					var piketDoctorID, piketNurseID string
					dbConnPiket, errPiket := db.ConnectPostgres("")
					if errPiket == nil {
						defer dbConnPiket.Close()
						_ = dbConnPiket.QueryRowContext(req.Context(), `
							SELECT dokter_id::text, COALESCE(perawat_id::text, '')
							FROM auth.jadwal_piket_poli
							WHERE poli_code = $1 AND piket_date = CURRENT_DATE
							LIMIT 1
						`, payload.DepartmentCode).Scan(&piketDoctorID, &piketNurseID)
					}

					todayWeekday := int32(time.Now().Weekday())
					if todayWeekday == 0 {
						todayWeekday = 7
					}

					if piketDoctorID != "" {
						// Ada dokter piket khusus hari ini!
						payload.DoctorId = piketDoctorID
						if payload.PerawatId == "" && piketNurseID != "" {
							payload.PerawatId = piketNurseID
						}
					} else {
						// Fallback ke jadwal reguler
						docRes, errDoc := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.GetDoctorsByPoliResponse, error) {
							return authClient.GetDoctorsByPoli(req.Context(), &authpb.GetDoctorsByPoliRequest{
								PoliCode:  payload.DepartmentCode,
								Page:      1,
								PageSize:  50,
								DayOfWeek: todayWeekday,
							})
						})
						if errDoc != nil || docRes == nil || len(docRes.Data) == 0 {
							response.JSON(w, http.StatusBadRequest, response.ErrorResponse{
								Success: false,
								Message: "Tidak ada jadwal dokter yang bertugas di poliklinik ini pada hari ini. Pendaftaran kunjungan tidak dapat diproses.",
							})
							return
						}

						if payload.DoctorId == "" {
							payload.DoctorId = docRes.Data[0].Id
						} else {
							doctorFound := false
							for _, d := range docRes.Data {
								if d.Id == payload.DoctorId {
									doctorFound = true
									break
								}
							}
							if !doctorFound {
								payload.DoctorId = docRes.Data[0].Id
							}
						}
					}

					// Auto-assign perawat dinas hari ini jika ada
					nurseRes, errNurse := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.GetNursesByPoliResponse, error) {
						return authClient.GetNursesByPoli(req.Context(), &authpb.GetNursesByPoliRequest{
							PoliCode:  payload.DepartmentCode,
							Page:      1,
							PageSize:  50,
							DayOfWeek: todayWeekday,
						})
					})
					if errNurse == nil && nurseRes != nil && len(nurseRes.Data) > 0 {
						if payload.PerawatId == "" {
							payload.PerawatId = nurseRes.Data[0].Id
						} else {
							nurseFound := false
							for _, n := range nurseRes.Data {
								if n.Id == payload.PerawatId {
									nurseFound = true
									break
								}
							}
							if !nurseFound {
								payload.PerawatId = nurseRes.Data[0].Id
							}
						}
					} else {
						payload.PerawatId = ""
					}

					res, err := circuitbreaker.CallGRPC(cbRegistration, func() (*regpb.RegisterEncounterResponse, error) {
						return regClient.RegisterEncounter(req.Context(), &payload)
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					if payload.Guarantor == "Umum" {
						fee := 150000.0
						if payload.DepartmentCode == "UMU" || payload.DepartmentCode == "01" || payload.DepartmentCode == "Poli Umum" || payload.DepartmentCode == "POLI_UMUM" {
							fee = 50000.0
						}

						_, errBilling := circuitbreaker.CallGRPC(cbBilling, func() (*billingpb.AddRegistrationFeeResponse, error) {
							return billingClient.AddRegistrationFee(req.Context(), &billingpb.AddRegistrationFeeRequest{
								EncounterNo:    res.EncounterNo,
								DepartmentCode: payload.DepartmentCode,
								Amount:         fee,
							})
						})

						if errBilling != nil {
							log.Printf("SAGA: Failed to add registration fee to billing for %s: %v. Continuing...", res.EncounterNo, errBilling)
						}
					}

					response.JSON(w, http.StatusOK, response.SuccessResponse{
						Success: true,
						Message: "Success",
						Data:    res,
					})
				})


				r.Post("/registrations/cancel", func(w http.ResponseWriter, req *http.Request) {
					var payload regpb.CancelEncounterRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					if err := validator.ValidateAll(map[string]func() error{
						"encounter_no": validator.NotEmpty(payload.EncounterNo),
						"reason":       validator.NotEmpty(payload.Reason),
					}); err != nil {
						response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := circuitbreaker.CallGRPC(cbRegistration, func() (*regpb.CancelEncounterResponse, error) {
						return regClient.CancelEncounter(req.Context(), &payload)
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

				r.Put("/registrations/guarantor", func(w http.ResponseWriter, req *http.Request) {
					var payload regpb.UpdateEncounterGuarantorRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					if err := validator.ValidateAll(map[string]func() error{
						"encounter_no": validator.NotEmpty(payload.EncounterNo),
						"guarantor":    validator.NotEmpty(payload.Guarantor),
					}); err != nil {
						response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := circuitbreaker.CallGRPC(cbRegistration, func() (*regpb.UpdateEncounterGuarantorResponse, error) {
						return regClient.UpdateEncounterGuarantor(req.Context(), &payload)
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
			// Shared (Admin, Super Admin, Nurse, Admisi, Doctor, Kasir)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("admin", "super_admin", "perawat", "admisi", "dokter", "kasir"))

				r.Get("/registrations/dashboard/metrics", func(w http.ResponseWriter, req *http.Request) {
					// 1. Get metrics from Registration Service
					regMetrics, err := circuitbreaker.CallGRPC(cbRegistration, func() (*regpb.GetDashboardMetricsResponse, error) {
						return regClient.GetDashboardMetrics(req.Context(), &regpb.GetDashboardMetricsRequest{})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}

					// 2. Get metrics from Auth Service
					authMetrics, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.GetActivePersonnelMetricsResponse, error) {
						return authClient.GetActivePersonnelMetrics(req.Context(), &authpb.GetActivePersonnelMetricsRequest{})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}

					// 3. Combine metrics
					response.JSON(w, http.StatusOK, response.SuccessResponse{
						Success: true,
						Message: "Dashboard metrics fetched successfully",
						Data: map[string]interface{}{
							"new_patients":   regMetrics.NewPatients,
							"old_patients":   regMetrics.OldPatients,
							"wait_times":     regMetrics.WaitTimes,
							"weekly_visits":  regMetrics.WeeklyVisits,
							"active_polis":   authMetrics.ActiveClinics,
							"active_doctors": authMetrics.ActiveDoctors,
							"active_nurses":  authMetrics.ActiveNurses,
						},
					})
				})

				r.Get("/registrations/today", func(w http.ResponseWriter, req *http.Request) {
					dateStr := req.URL.Query().Get("date")
					queueOnly := req.URL.Query().Get("queue_only") == "true"

					reqDate := dateStr
					if reqDate == "TODAY" || reqDate == time.Now().Format("2006-01-02") {
						reqDate = ""
					}

					// 1. Get encounters from Registration Service
					resReg, err := circuitbreaker.CallGRPC(cbRegistration, func() (*regpb.GetTodayEncountersResponse, error) {
						return regClient.GetTodayEncounters(req.Context(), &regpb.GetTodayEncountersRequest{Page: 1, PageSize: 100, Date: reqDate})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}

					// 2. Map and enrich with Patient names and Status Pasien Baru/Lama
					type EnrichedEncounter struct {
						EncounterNo    string `json:"encounter_no"`
						MRN            string `json:"mrn"`
						PatientName    string `json:"patient_name"`
						Gender         string `json:"gender"`
						DateOfBirth    string `json:"date_of_birth"`
						DepartmentCode string `json:"department_code"`
						DoctorID       string `json:"doctor_id"`
						PerawatID      string `json:"perawat_id"`
						Status         string `json:"status"`
						StatusPasien   string `json:"status_pasien"` // "Baru RS" or "Lama RS"
						RegisteredTime string `json:"registered_time"`
					}

					var enriched []EnrichedEncounter

					for _, enc := range resReg.Encounters {
						if queueOnly {
							if enc.Status != "QUEUED" && enc.Status != "QUEUED_FOR_POLI" && enc.Status != "WAITING_FOR_TRIAGE" && enc.Status != "IN_PROGRESS" {
								continue
							}
						}
						// Fetch Patient Details for enrichment
						var pName = "-"
						var pGender = "-"
						var pDob = "-"

						mrnClean := strings.TrimSpace(enc.Mrn)
						resPat, errPat := circuitbreaker.CallGRPC(cbPatient, func() (*patientpb.GetPatientByMRNResponse, error) {
							return patientClient.GetPatientByMRN(req.Context(), &patientpb.GetPatientByMRNRequest{Mrn: mrnClean})
						})
						if errPat == nil && resPat != nil && resPat.Patient != nil {
							pName = resPat.Patient.Name
							pGender = resPat.Patient.Gender
							pDob = resPat.Patient.Dob
						} else if errPat != nil {
							if st, ok := status.FromError(errPat); !ok || st.Code() != codes.NotFound {
								slog.Warn("Failed to fetch patient for encounter", "mrn", mrnClean, "err", errPat)
							}
						}

						// Extract RegisteredTime and IsNewPatient from enc.RegisteredTime
						parts := strings.Split(enc.RegisteredTime, "|")
						regTime := parts[0]
						isNew := "Lama RS"
						if len(parts) > 1 && parts[1] == "true" {
							isNew = "Baru RS"
						}

						enriched = append(enriched, EnrichedEncounter{
							EncounterNo:    enc.EncounterNo,
							MRN:            enc.Mrn,
							PatientName:    pName,
							Gender:         pGender,
							DateOfBirth:    pDob,
							DepartmentCode: enc.DepartmentCode,
							DoctorID:       enc.DoctorId,
							PerawatID:      enc.PerawatId,
							Status:         enc.Status,
							StatusPasien:   isNew,
							RegisteredTime: regTime,
						})
					}

					response.JSON(w, http.StatusOK, response.SuccessResponse{
						Success: true,
						Message: "Success",
						Data: map[string]interface{}{
							"encounters": enriched,
							"total":      len(enriched),
						},
					})
				})
			})

			// AI Admin Settings (Admin, Super Admin)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("admin", "super_admin"))

				r.Get("/admin/ai/models", func(w http.ResponseWriter, req *http.Request) {
					ctx := context.Background()
					client, err := genai.NewClient(ctx, nil)
					if err != nil {
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "Failed to create GenAI client: " + err.Error()})
						return
					}

					var models []string
					iter, err := client.Models.List(ctx, nil)
					if err != nil {
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "Failed to list models: " + err.Error()})
						return
					}
					for {
						m, err := iter.Next(ctx)
						if err == iterator.Done {
							break
						}
						if err != nil {
							log.Printf("Error fetching models: %v", err)
							break
						}
						models = append(models, m.Name)
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: models})
				})

				r.Get("/admin/ai/settings", func(w http.ResponseWriter, req *http.Request) {
					dbConn, dbErr := db.ConnectPostgres("")
					var modelName string
					var err error
					if dbErr == nil {
						defer dbConn.Close()
						err = dbConn.QueryRowContext(req.Context(), "SELECT value FROM auth.system_settings WHERE key = $1", "gemini_ocr_model").Scan(&modelName)
					} else {
						err = dbErr
					}
					if err != nil {
						modelName = "gemini-3.6-flash" // default fallback
					}
					data := map[string]string{"gemini_ocr_model": modelName}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: data})
				})

				r.Put("/admin/ai/settings", func(w http.ResponseWriter, req *http.Request) {
					var payload struct {
						ModelName string `json:"gemini_ocr_model"`
					}
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "Invalid request body"})
						return
					}
					if payload.ModelName == "" {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "gemini_ocr_model is required"})
						return
					}
					dbConn, dbErr := db.ConnectPostgres("")
					if dbErr != nil {
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "Database connection failed"})
						return
					}
					defer dbConn.Close()

					_, err := dbConn.ExecContext(req.Context(), `
						INSERT INTO auth.system_settings (key, value, updated_by)
						VALUES ($1, $2, $3)
						ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by
					`, "gemini_ocr_model", payload.ModelName, "admin")

					if err != nil {
						log.Printf("Failed to save settings: %v", err)
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "Failed to update settings"})
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Settings updated"})
				})
			})

			// EMR (Doctor, Nurse)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("dokter", "perawat", "rekam_medis"))

				r.Get("/emr/my-poli", func(w http.ResponseWriter, req *http.Request) {
					userID := req.Context().Value("userID").(string)
					res, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.GetAssignedPoliResponse, error) {
						return authClient.GetAssignedPoli(req.Context(), &authpb.GetAssignedPoliRequest{
							UserId: userID,
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

				r.Post("/emr/triage", func(w http.ResponseWriter, req *http.Request) {
					var payload rawatjalanpb.SubmitTriageRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.SubmitTriageResponse, error) {
						return rawatJalanClient.SubmitTriage(req.Context(), &payload)
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
					var payload rawatjalanpb.StartEncounterRequest
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
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.StartEncounterResponse, error) {
						return rawatJalanClient.StartEncounter(req.Context(), &payload)
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}

					// Sync with registration service
					_, _ = circuitbreaker.CallGRPC(cbRegistration, func() (*regpb.UpdateEncounterStatusResponse, error) {
						return regClient.UpdateEncounterStatus(req.Context(), &regpb.UpdateEncounterStatusRequest{
							EncounterNo: payload.EncounterNo,
							Status:      "IN_PROGRESS",
						})
					})

					response.JSON(w, http.StatusOK, response.SuccessResponse{
						Success: true,
						Message: "Success",
						Data:    res,
					})
				})

				r.Post("/emr/complete", func(w http.ResponseWriter, req *http.Request) {
					var payload rawatjalanpb.CompleteEncounterRequest
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
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.CompleteEncounterResponse, error) {
						return rawatJalanClient.CompleteEncounter(req.Context(), &payload)
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}

					// Sync with registration service
					_, _ = circuitbreaker.CallGRPC(cbRegistration, func() (*regpb.UpdateEncounterStatusResponse, error) {
						return regClient.UpdateEncounterStatus(req.Context(), &regpb.UpdateEncounterStatusRequest{
							EncounterNo: payload.EncounterNo,
							Status:      "COMPLETED",
						})
					})

					response.JSON(w, http.StatusOK, response.SuccessResponse{
						Success: true,
						Message: "Pemeriksaan pasien berhasil diselesaikan",
						Data:    res,
					})
				})

				r.Post("/emr/diagnosis", func(w http.ResponseWriter, req *http.Request) {
					var payload rawatjalanpb.AddEncounterDiagnosisRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					if err := validator.ValidateAll(map[string]func() error{
						"encounter_no":   validator.NotEmpty(payload.EncounterNo),
						"icd10_code":     validator.NotEmpty(payload.Icd10Code),
						"diagnosis_type": validator.NotEmpty(payload.DiagnosisType),
						"severity_level": validator.NotEmpty(payload.SeverityLevel),
					}); err != nil {
						response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.AddEncounterDiagnosisResponse, error) {
						return rawatJalanClient.AddEncounterDiagnosis(req.Context(), &payload)
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

				r.Put("/emr/diagnosis/{id}", func(w http.ResponseWriter, req *http.Request) {
					id := chi.URLParam(req, "id")
					var payload rawatjalanpb.UpdateEncounterDiagnosisRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					payload.Id = id
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.UpdateEncounterDiagnosisResponse, error) {
						return rawatJalanClient.UpdateEncounterDiagnosis(req.Context(), &payload)
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

				r.Delete("/emr/diagnosis/{id}", func(w http.ResponseWriter, req *http.Request) {
					id := chi.URLParam(req, "id")
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.RemoveEncounterDiagnosisResponse, error) {
						return rawatJalanClient.RemoveEncounterDiagnosis(req.Context(), &rawatjalanpb.RemoveEncounterDiagnosisRequest{Id: id})
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

				r.Post("/emr/encounter/{encounter_no}/severity/finalize", func(w http.ResponseWriter, req *http.Request) {
					encounterNo := chi.URLParam(req, "encounter_no")
					var payload struct {
						SeverityLevel string `json:"severity_level"`
					}
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					userId, _ := req.Context().Value("user_id").(string)
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.FinalizeSeverityResponse, error) {
						return rawatJalanClient.FinalizeSeverity(req.Context(), &rawatjalanpb.FinalizeSeverityRequest{
							EncounterNo:   encounterNo,
							SeverityLevel: payload.SeverityLevel,
							UserId:        userId,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{
						Success: true,
						Message: "Severity finalized successfully",
						Data:    res,
					})
				})

				r.Post("/emr/diagnosis/{id}/verify-kbm", func(w http.ResponseWriter, req *http.Request) {
					id := chi.URLParam(req, "id")
					var payload struct {
						KbmCode string `json:"kbm_code"`
					}
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					userId, _ := req.Context().Value("user_id").(string)
					res, err := circuitbreaker.CallGRPC(cbMedicalRecord, func() (*emrpb.VerifyKBMMappingResponse, error) {
						return medicalRecordClient.VerifyKBMMapping(req.Context(), &emrpb.VerifyKBMMappingRequest{
							Id:      id,
							KbmCode: payload.KbmCode,
							UserId:  userId,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{
						Success: true,
						Message: "KBM mapped successfully",
						Data:    res,
					})
				})

				r.Post("/emr/actions", func(w http.ResponseWriter, req *http.Request) {
					var payload rawatjalanpb.AddMedicalActionRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.AddMedicalActionResponse, error) {
						return rawatJalanClient.AddMedicalAction(req.Context(), &payload)
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

				r.Delete("/emr/actions/{id}", func(w http.ResponseWriter, req *http.Request) {
					id := chi.URLParam(req, "id")
					encounterNo := req.URL.Query().Get("encounter_no")
					actionCode := req.URL.Query().Get("action_code")

					if encounterNo != "" && actionCode != "" {
						invRes, errInv := circuitbreaker.CallGRPC(cbBilling, func() (*billingpb.GetActionPaymentStatusResponse, error) {
							return billingClient.GetActionPaymentStatus(req.Context(), &billingpb.GetActionPaymentStatusRequest{
								EncounterNo: encounterNo,
								ActionCode:  actionCode,
							})
						})
						if errInv == nil && invRes != nil && invRes.IsFound && invRes.IsPaid {
							response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{
								Success: false,
								Message: "Tindakan tidak dapat dihapus karena tagihan tindakan sudah dibayar di kasir.",
							})
							return
						}
					}

					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.RemoveMedicalActionResponse, error) {
						return rawatJalanClient.RemoveMedicalAction(req.Context(), &rawatjalanpb.RemoveMedicalActionRequest{
							Id:          id,
							EncounterNo: encounterNo,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{
						Success: true,
						Message: "Tindakan medis berhasil dihapus",
						Data:    res,
					})
				})

				r.Get("/emr/record/{encounter_no}", func(w http.ResponseWriter, req *http.Request) {
					encounterNo := chi.URLParam(req, "encounter_no")
					res, err := circuitbreaker.CallGRPC(cbMedicalRecord, func() (*emrpb.GetMedicalRecordResponse, error) {
						return medicalRecordClient.GetMedicalRecord(req.Context(), &emrpb.GetMedicalRecordRequest{EncounterNo: encounterNo})
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

			// KBM (Doctor, Nurse)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("dokter", "perawat"))
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

			// EMR (Dokter - verify ICD10 & pending review)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("dokter", "admin", "rekam_medis"))
				r.Get("/emr/pending-kbm-verifications", func(w http.ResponseWriter, req *http.Request) {
					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.ListPendingKBMVerificationsResponse, error) {
						return emrClient.ListPendingKBMVerifications(req.Context(), &emrpb.ListPendingKBMVerificationsRequest{})
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

				r.Get("/emr/icd10/{code}/kbm-suggestions", func(w http.ResponseWriter, req *http.Request) {
					code := chi.URLParam(req, "code")
					res, err := circuitbreaker.CallGRPC(cbEMR, func() (*emrpb.GetKBMSuggestionsForICD10Response, error) {
						return emrClient.GetKBMSuggestionsForICD10(req.Context(), &emrpb.GetKBMSuggestionsForICD10Request{Icd10Code: code})
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

			// ─── Rawat Jalan Service Routes ─────────────────────────────
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("dokter", "perawat", "admin", "super_admin"))

				r.Post("/rawat-jalan/triage", func(w http.ResponseWriter, req *http.Request) {
					var payload rawatjalanpb.SubmitTriageRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.SubmitTriageResponse, error) {
						return rawatJalanClient.SubmitTriage(req.Context(), &payload)
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}

					_, _ = circuitbreaker.CallGRPC(cbRegistration, func() (*regpb.UpdateEncounterStatusResponse, error) {
						return regClient.UpdateEncounterStatus(req.Context(), &regpb.UpdateEncounterStatusRequest{
							EncounterNo: payload.EncounterNo,
							Status:      "IN_PROGRESS",
						})
					})

					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
				})

				r.Post("/rawat-jalan/encounter/start", func(w http.ResponseWriter, req *http.Request) {
					var payload rawatjalanpb.StartEncounterRequest
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
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.StartEncounterResponse, error) {
						return rawatJalanClient.StartEncounter(req.Context(), &payload)
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					_, _ = circuitbreaker.CallGRPC(cbRegistration, func() (*regpb.UpdateEncounterStatusResponse, error) {
						return regClient.UpdateEncounterStatus(req.Context(), &regpb.UpdateEncounterStatusRequest{
							EncounterNo: payload.EncounterNo,
							Status:      "IN_PROGRESS",
						})
					})
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
				})

				r.Post("/rawat-jalan/encounter/reset", func(w http.ResponseWriter, req *http.Request) {
					var payload struct {
						EncounterNo string `json:"encounter_no"`
					}
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					if payload.EncounterNo == "" {
						response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: "encounter_no is required"})
						return
					}

					// Pengecekan keamanan: Jangan pernah mereset kunjungan yang sudah dibatalkan atau selesai
					medRec, errMed := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.GetMedicalRecordResponse, error) {
						return rawatJalanClient.GetMedicalRecord(req.Context(), &rawatjalanpb.GetMedicalRecordRequest{
							EncounterNo: payload.EncounterNo,
						})
					})
					if errMed == nil && medRec != nil && (medRec.Status == "CANCELLED" || medRec.Status == "BATAL" || medRec.Status == "COMPLETED") {
						response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Encounter is cancelled or completed; reset skipped"})
						return
					}

					_, _ = circuitbreaker.CallGRPC(cbRegistration, func() (*regpb.UpdateEncounterStatusResponse, error) {
						return regClient.UpdateEncounterStatus(req.Context(), &regpb.UpdateEncounterStatusRequest{
							EncounterNo: payload.EncounterNo,
							Status:      "QUEUED_FOR_POLI",
						})
					})
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Encounter status reset to queue"})
				})

				r.Post("/rawat-jalan/encounter/complete", func(w http.ResponseWriter, req *http.Request) {
					var payload rawatjalanpb.CompleteEncounterRequest
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
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.CompleteEncounterResponse, error) {
						return rawatJalanClient.CompleteEncounter(req.Context(), &payload)
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					_, _ = circuitbreaker.CallGRPC(cbRegistration, func() (*regpb.UpdateEncounterStatusResponse, error) {
						return regClient.UpdateEncounterStatus(req.Context(), &regpb.UpdateEncounterStatusRequest{
							EncounterNo: payload.EncounterNo,
							Status:      "COMPLETED",
						})
					})
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Pemeriksaan pasien berhasil diselesaikan", Data: res})
				})

				r.Post("/rawat-jalan/diagnosis", func(w http.ResponseWriter, req *http.Request) {
					var payload rawatjalanpb.AddEncounterDiagnosisRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					if err := validator.ValidateAll(map[string]func() error{
						"encounter_no":   validator.NotEmpty(payload.EncounterNo),
						"icd10_code":     validator.NotEmpty(payload.Icd10Code),
						"diagnosis_type": validator.NotEmpty(payload.DiagnosisType),
						"severity_level": validator.NotEmpty(payload.SeverityLevel),
					}); err != nil {
						response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.AddEncounterDiagnosisResponse, error) {
						return rawatJalanClient.AddEncounterDiagnosis(req.Context(), &payload)
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
				})

				r.Put("/rawat-jalan/diagnosis/{id}", func(w http.ResponseWriter, req *http.Request) {
					id := chi.URLParam(req, "id")
					var payload rawatjalanpb.UpdateEncounterDiagnosisRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					payload.Id = id
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.UpdateEncounterDiagnosisResponse, error) {
						return rawatJalanClient.UpdateEncounterDiagnosis(req.Context(), &payload)
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
				})

				r.Delete("/rawat-jalan/diagnosis/{id}", func(w http.ResponseWriter, req *http.Request) {
					id := chi.URLParam(req, "id")
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.RemoveEncounterDiagnosisResponse, error) {
						return rawatJalanClient.RemoveEncounterDiagnosis(req.Context(), &rawatjalanpb.RemoveEncounterDiagnosisRequest{Id: id})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
				})

				r.Post("/rawat-jalan/diagnosis/{id}/promote", func(w http.ResponseWriter, req *http.Request) {
					id := chi.URLParam(req, "id")
					var payload struct {
						EncounterNo string `json:"encounter_no"`
					}
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.PromoteDiagnosisToPrimaryResponse, error) {
						return rawatJalanClient.PromoteDiagnosisToPrimary(req.Context(), &rawatjalanpb.PromoteDiagnosisToPrimaryRequest{
							EncounterNo: payload.EncounterNo,
							DiagnosisId: id,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
				})

				r.Post("/rawat-jalan/encounter/{encounter_no}/severity/finalize", func(w http.ResponseWriter, req *http.Request) {
					encounterNo := chi.URLParam(req, "encounter_no")
					var payload struct {
						SeverityLevel string `json:"severity_level"`
					}
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					userId, _ := req.Context().Value("user_id").(string)
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.FinalizeSeverityResponse, error) {
						return rawatJalanClient.FinalizeSeverity(req.Context(), &rawatjalanpb.FinalizeSeverityRequest{
							EncounterNo:   encounterNo,
							SeverityLevel: payload.SeverityLevel,
							UserId:        userId,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Severity finalized successfully", Data: res})
				})

				r.Post("/rawat-jalan/actions", func(w http.ResponseWriter, req *http.Request) {
					var payload rawatjalanpb.AddMedicalActionRequest
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.AddMedicalActionResponse, error) {
						return rawatJalanClient.AddMedicalAction(req.Context(), &payload)
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
				})

				r.Delete("/rawat-jalan/actions/{id}", func(w http.ResponseWriter, req *http.Request) {
					id := chi.URLParam(req, "id")
					encounterNo := req.URL.Query().Get("encounter_no")
					actionCode := req.URL.Query().Get("action_code")

					if encounterNo != "" && actionCode != "" {
						invRes, errInv := circuitbreaker.CallGRPC(cbBilling, func() (*billingpb.GetActionPaymentStatusResponse, error) {
							return billingClient.GetActionPaymentStatus(req.Context(), &billingpb.GetActionPaymentStatusRequest{
								EncounterNo: encounterNo,
								ActionCode:  actionCode,
							})
						})
						if errInv == nil && invRes != nil && invRes.IsFound && invRes.IsPaid {
							response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{
								Success: false,
								Message: "Tindakan tidak dapat dihapus karena tagihan tindakan sudah dibayar di kasir.",
							})
							return
						}
					}

					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.RemoveMedicalActionResponse, error) {
						return rawatJalanClient.RemoveMedicalAction(req.Context(), &rawatjalanpb.RemoveMedicalActionRequest{
							Id:          id,
							EncounterNo: encounterNo,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{
						Success: true,
						Message: "Tindakan medis berhasil dihapus",
						Data:    res,
					})
				})

				r.Get("/rawat-jalan/record/{encounter_no}", func(w http.ResponseWriter, req *http.Request) {
					encounterNo := chi.URLParam(req, "encounter_no")
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.GetMedicalRecordResponse, error) {
						return rawatJalanClient.GetMedicalRecord(req.Context(), &rawatjalanpb.GetMedicalRecordRequest{EncounterNo: encounterNo})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}

					// Sinkronisasi status resmi encounter dari Registration Service
					var encDate string
					if len(encounterNo) >= 8 {
						encDate = fmt.Sprintf("%s-%s-%s", encounterNo[0:4], encounterNo[4:6], encounterNo[6:8])
					}
					resReg, errReg := circuitbreaker.CallGRPC(cbRegistration, func() (*regpb.GetTodayEncountersResponse, error) {
						return regClient.GetTodayEncounters(req.Context(), &regpb.GetTodayEncountersRequest{
							Page:     1,
							PageSize: 200,
							Date:     encDate,
						})
					})
					if errReg == nil && resReg != nil {
						for _, enc := range resReg.Encounters {
							if enc.EncounterNo == encounterNo {
								res.Status = enc.Status
								break
							}
						}
					}

					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
				})

				r.Get("/rawat-jalan/kbm/search", func(w http.ResponseWriter, req *http.Request) {
					query := req.URL.Query().Get("q")
					deptCode := req.URL.Query().Get("dept_code")
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.SearchKBMResponse, error) {
						return rawatJalanClient.SearchKBM(req.Context(), &rawatjalanpb.SearchKBMRequest{
							Query:          query,
							DepartmentCode: deptCode,
							Limit:          20,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
				})

				r.Get("/rawat-jalan/kbm/{code}", func(w http.ResponseWriter, req *http.Request) {
					code := chi.URLParam(req, "code")
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.GetKBMDetailResponse, error) {
						return rawatJalanClient.GetKBMDetail(req.Context(), &rawatjalanpb.GetKBMDetailRequest{KbmCode: code})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
				})

				r.Get("/rawat-jalan/icd10/{code}/kbm-suggestions", func(w http.ResponseWriter, req *http.Request) {
					code := chi.URLParam(req, "code")
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.GetKBMSuggestionsForICD10Response, error) {
						return rawatJalanClient.GetKBMSuggestionsForICD10(req.Context(), &rawatjalanpb.GetKBMSuggestionsForICD10Request{Icd10Code: code})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
				})

				r.Get("/rawat-jalan/master/tindakan/poli/{poli_code}", func(w http.ResponseWriter, req *http.Request) {
					poliCode := chi.URLParam(req, "poli_code")
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.GetMasterTindakanByPoliResponse, error) {
						return rawatJalanClient.GetMasterTindakanByPoli(req.Context(), &rawatjalanpb.GetMasterTindakanByPoliRequest{
							PoliCode:   poliCode,
							Page:       int32(page),
							PageSize:   int32(pageSize),
							SearchName: req.URL.Query().Get("search_name"),
							SearchCode: req.URL.Query().Get("search_code"),
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res.Data})
				})

				r.Get("/rawat-jalan/master/icd10/poli/{poli_code}", func(w http.ResponseWriter, req *http.Request) {
					poliCode := chi.URLParam(req, "poli_code")
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.GetMasterICD10ByPoliResponse, error) {
						return rawatJalanClient.GetMasterICD10ByPoli(req.Context(), &rawatjalanpb.GetMasterICD10ByPoliRequest{
							PoliCode:   poliCode,
							Page:       int32(page),
							PageSize:   int32(pageSize),
							SearchName: req.URL.Query().Get("search_name"),
							SearchCode: req.URL.Query().Get("search_code"),
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res.Data})
				})

				r.Get("/rawat-jalan/master/kbm/poli/{poli_code}", func(w http.ResponseWriter, req *http.Request) {
					poliCode := chi.URLParam(req, "poli_code")
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					res, err := circuitbreaker.CallGRPC(cbRawatJalan, func() (*rawatjalanpb.GetMasterKBMsByPoliResponse, error) {
						return rawatJalanClient.GetMasterKBMsByPoli(req.Context(), &rawatjalanpb.GetMasterKBMsByPoliRequest{
							PoliCode:   poliCode,
							Page:       int32(page),
							PageSize:   int32(pageSize),
							SearchName: req.URL.Query().Get("search_name"),
							SearchCode: req.URL.Query().Get("search_code"),
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res.Data})
				})
			})

			// ─── Rekam Medis Service Routes ─────────────────────────────
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("rekam_medis", "admin", "super_admin", "dokter"))

				r.Get("/rekam-medis/record/{encounter_no}", func(w http.ResponseWriter, req *http.Request) {
					encounterNo := chi.URLParam(req, "encounter_no")
					res, err := circuitbreaker.CallGRPC(cbMedicalRecord, func() (*emrpb.GetMedicalRecordResponse, error) {
						return medicalRecordClient.GetMedicalRecord(req.Context(), &emrpb.GetMedicalRecordRequest{EncounterNo: encounterNo})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
				})

				r.Post("/rekam-medis/coding/verify-kbm/{id}", func(w http.ResponseWriter, req *http.Request) {
					id := chi.URLParam(req, "id")
					var payload struct {
						KbmCode string `json:"kbm_code"`
					}
					if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
						return
					}
					userId, _ := req.Context().Value("user_id").(string)
					res, err := circuitbreaker.CallGRPC(cbMedicalRecord, func() (*emrpb.VerifyKBMMappingResponse, error) {
						return medicalRecordClient.VerifyKBMMapping(req.Context(), &emrpb.VerifyKBMMappingRequest{
							Id:      id,
							KbmCode: payload.KbmCode,
							UserId:  userId,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "KBM mapped successfully", Data: res})
				})

				r.Get("/rekam-medis/coding/pending-kbm", func(w http.ResponseWriter, req *http.Request) {
					res, err := circuitbreaker.CallGRPC(cbMedicalRecord, func() (*emrpb.ListPendingKBMVerificationsResponse, error) {
						return medicalRecordClient.ListPendingKBMVerifications(req.Context(), &emrpb.ListPendingKBMVerificationsRequest{})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
				})
			})

			// Pharmacy (Pharmacist, Admin)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("asisten_apoteker", "admin"))
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
				r.Use(middleware.RequireRole("kasir", "admin"))

				deptNameHelper := func(code string) string {
					switch code {
					case "01", "UMU":
						return "Poli Umum"
					case "02":
						return "Poli Gigi"
					case "03":
						return "Poli Anak"
					case "04":
						return "Poli Penyakit Dalam"
					case "05":
						return "Poli Bedah"
					case "06":
						return "Poli Mata"
					case "07":
						return "Poli THT"
					case "08":
						return "Poli Kandungan"
					default:
						return "Poli " + code
					}
				}

				r.Get("/billing/reports/rekap", func(w http.ResponseWriter, req *http.Request) {
					dateStr := req.URL.Query().Get("date")
					startDate := req.URL.Query().Get("start_date")
					endDate := req.URL.Query().Get("end_date")
					filterDept := req.URL.Query().Get("department_code")
					filterMethod := req.URL.Query().Get("payment_method")

					var reqDate string
					var periodStr string

					if startDate != "" && endDate != "" {
						reqDate = startDate + ":" + endDate
						if startDate == endDate {
							periodStr = startDate
						} else {
							periodStr = startDate + " s/d " + endDate
						}
					} else if dateStr != "" && dateStr != "TODAY" {
						reqDate = dateStr
						periodStr = dateStr
					} else {
						today := time.Now().Format("2006-01-02")
						reqDate = today
						periodStr = today
					}

					resReg, err := circuitbreaker.CallGRPC(cbRegistration, func() (*regpb.GetTodayEncountersResponse, error) {
						return regClient.GetTodayEncounters(req.Context(), &regpb.GetTodayEncountersRequest{Page: 1, PageSize: 5000, Date: reqDate})
					})

					type SettlementItem struct {
						ItemType    string  `json:"item_type"`
						Description string  `json:"description"`
						Qty         int     `json:"qty"`
						Amount      float64 `json:"amount"`
					}

					type SettlementTransaction struct {
						InvoiceID      string           `json:"invoice_id"`
						ReceiptNo      string           `json:"receipt_no"`
						EncounterNo    string           `json:"encounter_no"`
						MRN            string           `json:"mrn"`
						PatientName    string           `json:"patient_name"`
						DepartmentCode string           `json:"department_code"`
						DepartmentName string           `json:"department_name"`
						PaymentMethod  string           `json:"payment_method"`
						TotalAmount    float64          `json:"total_amount"`
						PaidAt         string           `json:"paid_at"`
						CashierName    string           `json:"cashier_name"`
						Status         string           `json:"status"`
						Items          []SettlementItem `json:"items"`
					}

					type ServiceBreakdown struct {
						DepartmentCode string  `json:"department_code"`
						DepartmentName string  `json:"department_name"`
						Count          int     `json:"count"`
						Total          float64 `json:"total"`
					}

					type RevenueMetrics struct {
						TotalRevenue      float64 `json:"total_revenue"`
						TotalTransactions int     `json:"total_transactions"`
						TunaiAmount       float64 `json:"tunai_amount"`
						TunaiCount        int     `json:"tunai_count"`
						QRISAmount        float64 `json:"qris_amount"`
						QRISCount         int     `json:"qris_count"`
						DebitAmount       float64 `json:"debit_amount"`
						DebitCount        int     `json:"debit_count"`
						BPJSAmount        float64 `json:"bpjs_amount"`
						BPJSCount         int     `json:"bpjs_count"`
						NonTunaiAmount    float64 `json:"non_tunai_amount"`
						NonTunaiCount     int     `json:"non_tunai_count"`
					}

					var transactions []SettlementTransaction
					serviceMap := make(map[string]*ServiceBreakdown)
					patientCache := make(map[string]string)
					var metrics RevenueMetrics

					// If regClient has encounters, iterate and build transactions
					if err == nil && resReg != nil && len(resReg.Encounters) > 0 {
						for _, enc := range resReg.Encounters {
							deptCode := enc.DepartmentCode
							if deptCode == "" {
								deptCode = "01"
							}
							deptName := deptNameHelper(deptCode)

							parts := strings.Split(enc.RegisteredTime, "|")
							timeStr := parts[0]
							if timeStr == "" {
								timeStr = "08:00"
							}

							resInvs, _ := circuitbreaker.CallGRPC(cbBilling, func() (*billingpb.GetInvoicesByEncounterResponse, error) {
								return billingClient.GetInvoicesByEncounter(req.Context(), &billingpb.GetInvoicesByEncounterRequest{EncounterNo: enc.EncounterNo})
							})

							pName, found := patientCache[enc.Mrn]
							if !found {
								pName = "Pasien " + enc.Mrn
								resPat, _ := circuitbreaker.CallGRPC(cbPatient, func() (*patientpb.GetPatientByMRNResponse, error) {
									return patientClient.GetPatientByMRN(req.Context(), &patientpb.GetPatientByMRNRequest{Mrn: enc.Mrn})
								})
								if resPat != nil && resPat.Patient != nil && resPat.Patient.Name != "" {
									pName = resPat.Patient.Name
								}
								patientCache[enc.Mrn] = pName
							}

							method := "CASH"

							if resInvs != nil && len(resInvs.Invoices) > 0 {
								for _, inv := range resInvs.Invoices {
									if !inv.IsPaid && inv.Status != "PAID" {
										continue
									}

									var txItems []SettlementItem
									for _, itm := range inv.Items {
										txItems = append(txItems, SettlementItem{
											ItemType:    itm.ItemType,
											Description: itm.Description,
											Qty:         1,
											Amount:      itm.Amount,
										})
									}
									amount := inv.TotalAmount
									if len(txItems) == 0 {
										txItems = append(txItems, SettlementItem{
											ItemType:    "ACTION",
											Description: "Pemeriksaan & Konsultasi " + deptName,
											Qty:         1,
											Amount:      amount,
										})
									}

									receiptNo := "KW-" + strings.TrimPrefix(inv.InvoiceId, "INV-")
									if receiptNo == "KW-" || receiptNo == "" {
										receiptNo = "KW-" + enc.EncounterNo
									}

									tx := SettlementTransaction{
										InvoiceID:      inv.InvoiceId,
										ReceiptNo:      receiptNo,
										EncounterNo:    enc.EncounterNo,
										MRN:            enc.Mrn,
										PatientName:    pName,
										DepartmentCode: deptCode,
										DepartmentName: deptName,
										PaymentMethod:  method,
										TotalAmount:    amount,
										PaidAt:         timeStr,
										CashierName:    "Staf Kasir 1",
										Status:         "PAID",
										Items:          txItems,
									}

									if filterDept != "" && filterDept != "ALL" && filterDept != deptCode {
										continue
									}
									if filterMethod != "" && filterMethod != "ALL" && filterMethod != method {
										continue
									}

									transactions = append(transactions, tx)

									metrics.TotalRevenue += amount
									metrics.TotalTransactions++
									switch method {
									case "CASH":
										metrics.TunaiAmount += amount
										metrics.TunaiCount++
									case "QRIS":
										metrics.QRISAmount += amount
										metrics.QRISCount++
									case "DEBIT":
										metrics.DebitAmount += amount
										metrics.DebitCount++
									case "BPJS":
										metrics.BPJSAmount += amount
										metrics.BPJSCount++
									}

									if _, exists := serviceMap[deptCode]; !exists {
										serviceMap[deptCode] = &ServiceBreakdown{
											DepartmentCode: deptCode,
											DepartmentName: deptName,
											Count:          0,
											Total:          0,
										}
									}
									serviceMap[deptCode].Count++
									serviceMap[deptCode].Total += amount
								}
							} else {
								// Fallback check if encounter was already processed in poli
								isPaid := enc.Status == "QUEUED_FOR_POLI" || 
									enc.Status == "IN_PROGRESS" || 
									enc.Status == "IN_EXAMINATION" || 
									enc.Status == "COMPLETED" || 
									enc.Status == "PAID"

								if !isPaid {
									continue
								}

								amount := 50000.0
								txItems := []SettlementItem{
									{
										ItemType:    "ACTION",
										Description: "Pemeriksaan & Konsultasi " + deptName,
										Qty:         1,
										Amount:      amount,
									},
								}

								tx := SettlementTransaction{
									InvoiceID:      "INV-REG-" + enc.EncounterNo,
									ReceiptNo:      "KW-REG-" + enc.EncounterNo,
									EncounterNo:    enc.EncounterNo,
									MRN:            enc.Mrn,
									PatientName:    pName,
									DepartmentCode: deptCode,
									DepartmentName: deptName,
									PaymentMethod:  method,
									TotalAmount:    amount,
									PaidAt:         timeStr,
									CashierName:    "Staf Kasir 1",
									Status:         "PAID",
									Items:          txItems,
								}

								if filterDept != "" && filterDept != "ALL" && filterDept != deptCode {
									continue
								}
								if filterMethod != "" && filterMethod != "ALL" && filterMethod != method {
									continue
								}

								transactions = append(transactions, tx)

								metrics.TotalRevenue += amount
								metrics.TotalTransactions++
								metrics.TunaiAmount += amount
								metrics.TunaiCount++

								if _, exists := serviceMap[deptCode]; !exists {
									serviceMap[deptCode] = &ServiceBreakdown{
										DepartmentCode: deptCode,
										DepartmentName: deptName,
										Count:          0,
										Total:          0,
									}
								}
								serviceMap[deptCode].Count++
								serviceMap[deptCode].Total += amount
							}
						}
					}

					metrics.NonTunaiAmount = metrics.QRISAmount + metrics.DebitAmount + metrics.BPJSAmount
					metrics.NonTunaiCount = metrics.QRISCount + metrics.DebitCount + metrics.BPJSCount

					var serviceBreakdownList []ServiceBreakdown
					for _, v := range serviceMap {
						serviceBreakdownList = append(serviceBreakdownList, *v)
					}
					sort.Slice(serviceBreakdownList, func(i, j int) bool {
						return serviceBreakdownList[i].Total > serviceBreakdownList[j].Total
					})

					response.JSON(w, http.StatusOK, response.SuccessResponse{
						Success: true,
						Message: "Success",
						Data: map[string]interface{}{
							"period":            periodStr,
							"metrics":           metrics,
							"service_breakdown": serviceBreakdownList,
							"transactions":      transactions,
						},
					})
				})

				r.Get("/billing/queue", func(w http.ResponseWriter, req *http.Request) {
					dateStr := req.URL.Query().Get("date")
					includeAll := req.URL.Query().Get("all") == "true" || req.URL.Query().Get("include_paid") == "true"
					reqDate := dateStr
					if reqDate == "TODAY" || reqDate == time.Now().Format("2006-01-02") {
						reqDate = ""
					}

					resReg, err := circuitbreaker.CallGRPC(cbRegistration, func() (*regpb.GetTodayEncountersResponse, error) {
						return regClient.GetTodayEncounters(req.Context(), &regpb.GetTodayEncountersRequest{Page: 1, PageSize: 5000, Date: reqDate})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}

					type BillingQueueItem struct {
						EncounterNo     string                     `json:"encounter_no"`
						MRN             string                     `json:"mrn"`
						PatientName     string                     `json:"patient_name"`
						Gender          string                     `json:"gender"`
						DateOfBirth     string                     `json:"date_of_birth"`
						DepartmentCode  string                     `json:"department_code"`
						DoctorID        string                     `json:"doctor_id"`
						Status          string                     `json:"status"`
						StatusPasien    string                     `json:"status_pasien"`
						RegisteredTime  string                     `json:"registered_time"`
						PaymentStatus   string                     `json:"payment_status"`
						HasUnpaid       bool                       `json:"has_unpaid"`
						TotalAmount     float64                    `json:"total_amount"`
						PaidAmount      float64                    `json:"paid_amount"`
						UnpaidAmount    float64                    `json:"unpaid_amount"`
						ActiveInvoiceID string                     `json:"active_invoice_id"`
						Invoices        []*billingpb.InvoiceDetail `json:"invoices"`
					}

					var queueList []BillingQueueItem

					for _, enc := range resReg.Encounters {
						var pName = "-"
						var pGender = "-"
						var pDob = "-"

						mrnClean := strings.TrimSpace(enc.Mrn)
						resPat, errPat := circuitbreaker.CallGRPC(cbPatient, func() (*patientpb.GetPatientByMRNResponse, error) {
							return patientClient.GetPatientByMRN(req.Context(), &patientpb.GetPatientByMRNRequest{Mrn: mrnClean})
						})
						if errPat == nil && resPat != nil && resPat.Patient != nil {
							pName = resPat.Patient.Name
							pGender = resPat.Patient.Gender
							pDob = resPat.Patient.Dob
						}

						parts := strings.Split(enc.RegisteredTime, "|")
						regTime := parts[0]
						isNew := "Lama RS"
						if len(parts) > 1 && parts[1] == "true" {
							isNew = "Baru RS"
						}

						// Fetch all invoices for this encounter
						var invoices []*billingpb.InvoiceDetail
						resInvs, _ := circuitbreaker.CallGRPC(cbBilling, func() (*billingpb.GetInvoicesByEncounterResponse, error) {
							return billingClient.GetInvoicesByEncounter(req.Context(), &billingpb.GetInvoicesByEncounterRequest{EncounterNo: enc.EncounterNo})
						})
						if resInvs != nil && len(resInvs.Invoices) > 0 {
							invoices = resInvs.Invoices
						} else {
							// If no invoice in billing db yet, generate initial registration invoice
							resGen, _ := circuitbreaker.CallGRPC(cbBilling, func() (*billingpb.GenerateInvoiceResponse, error) {
								return billingClient.GenerateInvoice(req.Context(), &billingpb.GenerateInvoiceRequest{EncounterNo: enc.EncounterNo})
							})
							if resGen != nil {
								invoices = append(invoices, &billingpb.InvoiceDetail{
									InvoiceId:   resGen.InvoiceId,
									EncounterNo: enc.EncounterNo,
									TotalAmount: resGen.TotalAmount,
									Status:      resGen.Status,
									IsPaid:      resGen.IsPaid,
									Items:       resGen.Items,
									CreatedAt:   time.Now().Format(time.RFC3339),
								})
							}
						}

						var totalAmount, paidAmount, unpaidAmount float64
						var hasUnpaid bool
						var activeInvID string

						for _, inv := range invoices {
							totalAmount += inv.TotalAmount
							if inv.IsPaid || inv.Status == "PAID" {
								paidAmount += inv.TotalAmount
							} else {
								unpaidAmount += inv.TotalAmount
								hasUnpaid = true
								if activeInvID == "" {
									activeInvID = inv.InvoiceId
								}
							}
						}

						if len(invoices) == 0 {
							fee := 50000.0
							if enc.DepartmentCode != "01" && enc.DepartmentCode != "UMU" && enc.DepartmentCode != "Poli Umum" {
								fee = 150000.0
							}
							totalAmount = fee
							if enc.Status == "WAITING_FOR_PAYMENT" || enc.Status == "REGISTERED" {
								unpaidAmount = fee
								hasUnpaid = true
							} else if enc.Status != "CANCELLED" && enc.Status != "BATAL" {
								paidAmount = fee
							}
						} else if !hasUnpaid && (enc.Status == "WAITING_FOR_PAYMENT" || enc.Status == "REGISTERED") {
							hasUnpaid = true
							if unpaidAmount == 0 {
								unpaidAmount = totalAmount
							}
						}

						paymentStatus := "PAID"
						if enc.Status == "CANCELLED" || enc.Status == "BATAL" {
							paymentStatus = "CANCELLED"
						} else if hasUnpaid {
							paymentStatus = "UNPAID"
						}

						// Only keep patients who actually need to make a payment
						if !includeAll {
							if enc.Status == "CANCELLED" || enc.Status == "BATAL" || !hasUnpaid || unpaidAmount <= 0 {
								continue
							}
						}

						queueList = append(queueList, BillingQueueItem{
							EncounterNo:     enc.EncounterNo,
							MRN:             enc.Mrn,
							PatientName:     pName,
							Gender:          pGender,
							DateOfBirth:     pDob,
							DepartmentCode:  enc.DepartmentCode,
							DoctorID:        enc.DoctorId,
							Status:          enc.Status,
							StatusPasien:    isNew,
							RegisteredTime:  regTime,
							PaymentStatus:   paymentStatus,
							HasUnpaid:       hasUnpaid,
							TotalAmount:     totalAmount,
							PaidAmount:      paidAmount,
							UnpaidAmount:    unpaidAmount,
							ActiveInvoiceID: activeInvID,
							Invoices:        invoices,
						})
					}

					response.JSON(w, http.StatusOK, response.SuccessResponse{
						Success: true,
						Message: "Success",
						Data:    queueList,
					})
				})

				r.Get("/billing/invoices/{encounter_no}", func(w http.ResponseWriter, req *http.Request) {
					encounterNo := chi.URLParam(req, "encounter_no")
					res, err := circuitbreaker.CallGRPC(cbBilling, func() (*billingpb.GetInvoicesByEncounterResponse, error) {
						return billingClient.GetInvoicesByEncounter(req.Context(), &billingpb.GetInvoicesByEncounterRequest{EncounterNo: encounterNo})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}

					response.JSON(w, http.StatusOK, response.SuccessResponse{
						Success: true,
						Message: "Success",
						Data:    res.Invoices,
					})
				})

				r.Get("/billing/invoice/{encounter_no}", func(w http.ResponseWriter, req *http.Request) {
					encounterNo := chi.URLParam(req, "encounter_no")
					res, err := circuitbreaker.CallGRPC(cbBilling, func() (*billingpb.GenerateInvoiceResponse, error) {
						return billingClient.GenerateInvoice(req.Context(), &billingpb.GenerateInvoiceRequest{EncounterNo: encounterNo})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}

					var patientName, mrn, poliName, doctorName string
					resEnc, errEnc := circuitbreaker.CallGRPC(cbRegistration, func() (*regpb.GetTodayEncountersResponse, error) {
						return regClient.GetTodayEncounters(req.Context(), &regpb.GetTodayEncountersRequest{Page: 1, PageSize: 5000})
					})
					if errEnc == nil && resEnc != nil {
						for _, enc := range resEnc.Encounters {
							if enc.EncounterNo == encounterNo {
								mrn = enc.Mrn
								poliName = deptNameHelper(enc.DepartmentCode)
								doctorName = enc.DoctorId
								break
							}
						}
					}
					if mrn != "" {
						resPat, _ := circuitbreaker.CallGRPC(cbPatient, func() (*patientpb.GetPatientByMRNResponse, error) {
							return patientClient.GetPatientByMRN(req.Context(), &patientpb.GetPatientByMRNRequest{Mrn: mrn})
						})
						if resPat != nil && resPat.Patient != nil {
							patientName = resPat.Patient.Name
						}
					}

					// Also fetch all invoices for this encounter
					resAll, _ := circuitbreaker.CallGRPC(cbBilling, func() (*billingpb.GetInvoicesByEncounterResponse, error) {
						return billingClient.GetInvoicesByEncounter(req.Context(), &billingpb.GetInvoicesByEncounterRequest{EncounterNo: encounterNo})
					})
					var allInvoices []*billingpb.InvoiceDetail
					if resAll != nil {
						allInvoices = resAll.Invoices
					}

					type EnrichedInvoiceResponse struct {
						Success     bool                       `json:"success"`
						InvoiceId   string                     `json:"invoice_id"`
						EncounterNo string                     `json:"encounter_no"`
						PatientName string                     `json:"patient_name"`
						MRN         string                     `json:"mrn"`
						PoliName    string                     `json:"poli_name"`
						DoctorName  string                     `json:"doctor_name"`
						Items       []*billingpb.InvoiceItem   `json:"items"`
						TotalAmount float64                    `json:"total_amount"`
						Status      string                     `json:"status"`
						IsPaid      bool                       `json:"is_paid"`
						Invoices    []*billingpb.InvoiceDetail `json:"invoices"`
						Message     string                     `json:"message"`
					}

					response.JSON(w, http.StatusOK, response.SuccessResponse{
						Success: true,
						Message: "Success",
						Data: EnrichedInvoiceResponse{
							Success:     res.Success,
							InvoiceId:   res.InvoiceId,
							EncounterNo: encounterNo,
							PatientName: patientName,
							MRN:         mrn,
							PoliName:    poliName,
							DoctorName:  doctorName,
							Items:       res.Items,
							TotalAmount: res.TotalAmount,
							Status:      res.Status,
							IsPaid:      res.IsPaid || res.Status == "PAID",
							Invoices:    allInvoices,
							Message:     res.Message,
						},
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

					// Notify Registration Service to update Encounter Status to QUEUED_FOR_POLI
					// ONLY if encounter is currently WAITING_FOR_PAYMENT or REGISTERED (do not regress if already in poli)
					if res.EncounterNo != "" {
						resEnc, _ := circuitbreaker.CallGRPC(cbRegistration, func() (*regpb.GetTodayEncountersResponse, error) {
							return regClient.GetTodayEncounters(req.Context(), &regpb.GetTodayEncountersRequest{Page: 1, PageSize: 5000})
						})
						shouldQueue := true
						if resEnc != nil {
							for _, enc := range resEnc.Encounters {
								if enc.EncounterNo == res.EncounterNo {
									if enc.Status == "IN_PROGRESS" || enc.Status == "IN_EXAMINATION" || enc.Status == "COMPLETED" || enc.Status == "QUEUED_FOR_POLI" {
										shouldQueue = false
									}
									break
								}
							}
						}
						if shouldQueue {
							_, errReg := circuitbreaker.CallGRPC(cbRegistration, func() (*regpb.UpdateEncounterStatusResponse, error) {
								return regClient.UpdateEncounterStatus(req.Context(), &regpb.UpdateEncounterStatusRequest{
									EncounterNo: res.EncounterNo,
									Status:      "QUEUED_FOR_POLI",
								})
							})
							if errReg != nil {
								slog.Warn("Failed to update encounter status after payment", "encounter_no", res.EncounterNo, "error", errReg)
							}
						}
					}

					response.JSON(w, http.StatusOK, response.SuccessResponse{
						Success: true,
						Message: "Success",
						Data:    res,
					})
				})

				r.Post("/cancel", func(w http.ResponseWriter, req *http.Request) {
					var payload billingpb.CancelInvoiceRequest
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
					res, err := circuitbreaker.CallGRPC(cbBilling, func() (*billingpb.CancelInvoiceResponse, error) {
						return billingClient.CancelInvoice(req.Context(), &payload)
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
		Addr:         "0.0.0.0:" + port,
		Handler:      r,
		ReadTimeout:  120 * time.Second,
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  120 * time.Second,
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

	// Log available Gemini models at startup for diagnostics
	go func() {
		diagCtx := context.Background()
		diagClient, err := genai.NewClient(diagCtx, nil)
		if err != nil {
			log.Printf("DIAG: Could not create genai client to list models: %v", err)
			return
		}
		page, err := diagClient.Models.List(diagCtx, nil)
		if err != nil {
			log.Printf("DIAG: Could not list genai models: %v", err)
			return
		}
		log.Println("DIAG: Available Gemini models:")
		for _, m := range page.Items {
			log.Printf("DIAG:   - %s", m.Name)
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
