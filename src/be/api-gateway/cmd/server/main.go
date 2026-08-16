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
	"regexp"
	"strconv"
	"time"

	"google.golang.org/genai"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/health/grpc_health_v1"

	"github.com/aliube/go-micro-simrs-one/api-gateway/internal/handlers"
	"github.com/aliube/go-micro-simrs-one/api-gateway/internal/middleware"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/auth"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/circuitbreaker"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/db"
	simrsmiddleware "github.com/aliube/go-micro-simrs-one/shared/pkg/middleware"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/response"
	"github.com/prometheus/client_golang/prometheus/promhttp"
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

		r.Post("/auth/signup/staff", func(w http.ResponseWriter, req *http.Request) {
			var payload authpb.SignupRequest
			if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
				response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
				return
			}
			if err := validator.ValidateAll(map[string]func() error{
				"nip":      validator.NotEmpty(payload.Username), // Username is NIP for staff
				"password": validator.MinLength(payload.Password, 6),
				"email":    validator.NotEmpty(payload.Email),
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


		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.AuthMiddleware(tokenManager))
			r.Use(simrsmiddleware.IdempotencyMiddleware(rdb, 24*time.Hour))
			
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
					if page <= 0 { page = 1 }
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					if pageSize <= 0 { pageSize = 50 }
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
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: (int(res.TotalCount) + pageSize - 1) / pageSize}
					if meta.Page < 1 { meta.Page = 1 }
					if meta.PageSize < 1 { meta.PageSize = 10 }
					if meta.TotalPages == 0 { meta.TotalPages = 1 }
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})

				r.Get("/master/nurses", func(w http.ResponseWriter, req *http.Request) {
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
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
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: (int(res.TotalCount) + pageSize - 1) / pageSize}
					if meta.Page < 1 { meta.Page = 1 }
					if meta.PageSize < 1 { meta.PageSize = 10 }
					if meta.TotalPages == 0 { meta.TotalPages = 1 }
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})
				
				r.Post("/master/doctors/assign", func(w http.ResponseWriter, req *http.Request) {
					var payload struct {
						DokterID  string `json:"dokter_id"`
						PoliCode  string `json:"poli_code"`
						StartDate string `json:"start_date"`
						EndDate   string `json:"end_date"`
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
							DokterId:  payload.DokterID,
							PoliCode:  payload.PoliCode,
							StartDate: payload.StartDate,
							EndDate:   payload.EndDate,
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
						PerawatID string `json:"perawat_id"`
						PoliCode  string `json:"poli_code"`
						StartDate string `json:"start_date"`
						EndDate   string `json:"end_date"`
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
							PerawatId: payload.PerawatID,
							PoliCode:  payload.PoliCode,
							StartDate: payload.StartDate,
							EndDate:   payload.EndDate,
						})
					})
					if err != nil {
						response.HandleGRPCError(w, err)
						return
					}
					response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Nurse assigned successfully"})
				})

				r.Get("/master/doctors/poli/{poli_code}", func(w http.ResponseWriter, req *http.Request) {
					poliCode := chi.URLParam(req, "poli_code")
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					search := req.URL.Query().Get("search")

					res, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.GetDoctorsByPoliResponse, error) {
						return authClient.GetDoctorsByPoli(req.Context(), &authpb.GetDoctorsByPoliRequest{
							PoliCode: poliCode,
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
					if meta.Page < 1 { meta.Page = 1 }
					if meta.PageSize < 1 { meta.PageSize = 10 }
					if meta.TotalPages == 0 { meta.TotalPages = 1 }
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})

				r.Get("/master/nurses/poli/{poli_code}", func(w http.ResponseWriter, req *http.Request) {
					poliCode := chi.URLParam(req, "poli_code")
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					search := req.URL.Query().Get("search")

					res, err := circuitbreaker.CallGRPC(cbAuth, func() (*authpb.GetNursesByPoliResponse, error) {
						return authClient.GetNursesByPoli(req.Context(), &authpb.GetNursesByPoliRequest{
							PoliCode: poliCode,
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
					if meta.Page < 1 { meta.Page = 1 }
					if meta.PageSize < 1 { meta.PageSize = 10 }
					if meta.TotalPages == 0 { meta.TotalPages = 1 }
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})
				r.Get("/master/polyclinics", func(w http.ResponseWriter, req *http.Request) {
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					search := req.URL.Query().Get("search")

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
					if meta.Page < 1 { meta.Page = 1 }
					if meta.PageSize < 1 { meta.PageSize = 10 }
					if meta.TotalPages == 0 { meta.TotalPages = 1 }
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})

				r.Get("/master/kbm", func(w http.ResponseWriter, req *http.Request) {
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					searchName := req.URL.Query().Get("search_name")
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
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: (int(res.TotalCount) + pageSize - 1) / pageSize}
					if meta.Page < 1 { meta.Page = 1 }
					if meta.PageSize < 1 { meta.PageSize = 10 }
					if meta.TotalPages == 0 { meta.TotalPages = 1 }
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})

				r.Get("/master/kbm/poli/{poli_code}", func(w http.ResponseWriter, req *http.Request) {
					poliCode := chi.URLParam(req, "poli_code")
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					searchName := req.URL.Query().Get("search_name")
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
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: (int(res.TotalCount) + pageSize - 1) / pageSize}
					if meta.Page < 1 { meta.Page = 1 }
					if meta.PageSize < 1 { meta.PageSize = 10 }
					if meta.TotalPages == 0 { meta.TotalPages = 1 }
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})

				r.Get("/master/tindakan", func(w http.ResponseWriter, req *http.Request) {
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					searchName := req.URL.Query().Get("search_name")
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
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: (int(res.TotalCount) + pageSize - 1) / pageSize}
					if meta.Page < 1 { meta.Page = 1 }
					if meta.PageSize < 1 { meta.PageSize = 10 }
					if meta.TotalPages == 0 { meta.TotalPages = 1 }
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})

				r.Get("/master/tindakan/poli/{poli_code}", func(w http.ResponseWriter, req *http.Request) {
					poliCode := chi.URLParam(req, "poli_code")
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					searchName := req.URL.Query().Get("search_name")
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
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: (int(res.TotalCount) + pageSize - 1) / pageSize}
					if meta.Page < 1 { meta.Page = 1 }
					if meta.PageSize < 1 { meta.PageSize = 10 }
					if meta.TotalPages == 0 { meta.TotalPages = 1 }
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})

				r.Get("/master/icd10", func(w http.ResponseWriter, req *http.Request) {
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					searchName := req.URL.Query().Get("search_name")
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
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: (int(res.TotalCount) + pageSize - 1) / pageSize}
					if meta.Page < 1 { meta.Page = 1 }
					if meta.PageSize < 1 { meta.PageSize = 10 }
					if meta.TotalPages == 0 { meta.TotalPages = 1 }
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})

				r.Get("/master/icd10/poli/{poli_code}", func(w http.ResponseWriter, req *http.Request) {
					poliCode := chi.URLParam(req, "poli_code")
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					searchName := req.URL.Query().Get("search_name")
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
					meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: (int(res.TotalCount) + pageSize - 1) / pageSize}
					if meta.Page < 1 { meta.Page = 1 }
					if meta.PageSize < 1 { meta.PageSize = 10 }
					if meta.TotalPages == 0 { meta.TotalPages = 1 }
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
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
					if meta.Page < 1 { meta.Page = 1 }
					if meta.PageSize < 1 { meta.PageSize = 10 }
					if meta.TotalPages == 0 { meta.TotalPages = 1 }
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
					if meta.Page < 1 { meta.Page = 1 }
					if meta.PageSize < 1 { meta.PageSize = 10 }
					if meta.TotalPages == 0 { meta.TotalPages = 1 }
					response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
				})
			})
			// Patient (Admin, Nurse, Admisi)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("admin", "nurse", "admisi"))
				
				r.Get("/patients", func(w http.ResponseWriter, req *http.Request) {
					search := req.URL.Query().Get("search")
					page, _ := strconv.Atoi(req.URL.Query().Get("page"))
					if page <= 0 { page = 1 }
					pageSize, _ := strconv.Atoi(req.URL.Query().Get("page_size"))
					if pageSize <= 0 { pageSize = 50 }
					
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
						TotalData: int(res.TotalCount),
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
						Data: map[string]string{"photo_url": photoUrl},
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

			// Registration (Admin, Nurse, Admisi)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireRole("admin", "nurse", "admisi"))
				
				r.Post("/registrations/ocr-ktp", func(w http.ResponseWriter, req *http.Request) {
					err := req.ParseMultipartForm(10 << 20)
					if err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "Failed to parse form: " + err.Error()})
						return
					}

					file, fileHeader, err := req.FormFile("ktp")
					if err != nil {
						response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "Failed to get KTP image: " + err.Error()})
						return
					}
					defer file.Close()

					imgData, err := io.ReadAll(file)
					if err != nil {
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "Failed to read KTP image: " + err.Error()})
						return
					}

					// Auto-detect MIME type from the uploaded file header
					mimeType := fileHeader.Header.Get("Content-Type")
					if mimeType == "" || mimeType == "application/octet-stream" {
						// Fallback: detect from first bytes (magic bytes)
						if len(imgData) > 3 && imgData[0] == 0x89 && imgData[1] == 0x50 {
							mimeType = "image/png"
						} else if len(imgData) > 2 && imgData[0] == 0xFF && imgData[1] == 0xD8 {
							mimeType = "image/jpeg"
						} else {
							mimeType = "image/jpeg" // safe default
						}
					}
					log.Printf("OCR-KTP: received file '%s', size=%d bytes, mimeType=%s", fileHeader.Filename, len(imgData), mimeType)

					ctx := context.Background()
					client, err := genai.NewClient(ctx, nil)
					if err != nil {
						log.Printf("ERROR OCR-KTP: failed to create GenAI client: %v", err)
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "Failed to create GenAI client: " + err.Error()})
						return
					}

					config := &genai.GenerateContentConfig{
						SystemInstruction: &genai.Content{
							Parts: []*genai.Part{
								genai.NewPartFromText("You are an expert OCR system for Indonesian Identity Cards (KTP). Extract the following fields from the KTP image: NIK (16-digit number), Name (Nama), Date of Birth in YYYY-MM-DD format (Tanggal Lahir), Gender as exactly 'Laki-laki' or 'Perempuan' (Jenis Kelamin), and full Address (Alamat). Return ONLY a valid JSON object with keys: nik, name, dob, gender, address. No markdown, no explanation."),
							},
						},
						ResponseMIMEType: "application/json",
					}

					log.Printf("OCR-KTP: calling Gemini API (model=gemini-3.5-flash)...")
					res, err := client.Models.GenerateContent(ctx, "gemini-3.5-flash", []*genai.Content{
						{
							Parts: []*genai.Part{
								genai.NewPartFromBytes(imgData, mimeType),
								genai.NewPartFromText("Please extract all KTP data fields from this image and return as JSON."),
							},
						},
					}, config)
					if err != nil {
						log.Printf("ERROR OCR-KTP: GenAI call failed: %v", err)
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "Failed to process KTP: " + err.Error()})
						return
					}

					log.Printf("OCR-KTP: Gemini responded, candidates=%d", len(res.Candidates))

					var extractedData map[string]string
					if len(res.Candidates) == 0 {
						log.Printf("ERROR OCR-KTP: Gemini returned 0 candidates")
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "Gemini returned empty response"})
						return
					}

					candidate := res.Candidates[0]
					if candidate.Content == nil || len(candidate.Content.Parts) == 0 {
						log.Printf("ERROR OCR-KTP: Gemini candidate has no content, FinishReason=%v", candidate.FinishReason)
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "Gemini returned no content"})
						return
					}

					rawText := candidate.Content.Parts[0].Text
					log.Printf("OCR-KTP: Gemini raw response text: %s", rawText)

					if rawText == "" {
						log.Printf("ERROR OCR-KTP: Gemini returned empty text")
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "Gemini returned empty text"})
						return
					}

					// Robust field extractor: parse each field individually from the raw text
					// so stray characters outside key:value pairs don't break parsing.
					fieldRe := regexp.MustCompile(`"(\w+)"\s*:\s*"([^"]*)"`)
					matches := fieldRe.FindAllStringSubmatch(rawText, -1)
					if len(matches) == 0 {
						log.Printf("ERROR OCR-KTP: No key:value pairs found in response | raw: %s", rawText)
						response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "Gemini response contained no extractable data"})
						return
					}
					extractedData = make(map[string]string)
					for _, m := range matches {
						extractedData[m[1]] = m[2]
					}
					log.Printf("OCR-KTP: Extracted %d fields: %+v", len(extractedData), extractedData)

					log.Printf("OCR-KTP: Successfully extracted data: %+v", extractedData)
					response.JSON(w, http.StatusOK, response.SuccessResponse{
						Success: true,
						Message: "Success",
						Data:    extractedData,
					})
				})

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
						Guarantor      string `json:"guarantor"` // Umum or BPJS
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
						if payload.DepartmentCode == "UMU" {
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
						"doctor_id":       validator.NotEmpty(payload.DoctorId),
						"guarantor":       validator.NotEmpty(payload.Guarantor),
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
					if payload.Guarantor == "Umum" {
						fee := 150000.0
						if payload.DepartmentCode == "UMU" {
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
				r.Get("/registrations/today", func(w http.ResponseWriter, req *http.Request) {
					dateStr := req.URL.Query().Get("date")
					queueOnly := req.URL.Query().Get("queue_only") == "true"
					
					// 1. Get encounters from Registration Service
					resReg, err := circuitbreaker.CallGRPC(cbRegistration, func() (*regpb.GetTodayEncountersResponse, error) {
						return regClient.GetTodayEncounters(req.Context(), &regpb.GetTodayEncountersRequest{Page: 1, PageSize: 100, Date: dateStr})
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
						DepartmentCode string `json:"department_code"`
						DoctorID       string `json:"doctor_id"`
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
						var isNew = "Lama RS"
						
						resPat, errPat := circuitbreaker.CallGRPC(cbPatient, func() (*patientpb.GetPatientByMRNResponse, error) {
							return patientClient.GetPatientByMRN(req.Context(), &patientpb.GetPatientByMRNRequest{Mrn: enc.Mrn})
						})
						if errPat == nil && resPat != nil && resPat.Patient != nil {
							pName = resPat.Patient.Name
							isNew = "Lama RS"
						} else {
							isNew = "Baru RS"
						}

						enriched = append(enriched, EnrichedEncounter{
							EncounterNo:    enc.EncounterNo,
							MRN:            enc.Mrn,
							PatientName:    pName,
							DepartmentCode: enc.DepartmentCode,
							DoctorID:       enc.DoctorId,
							Status:         enc.Status,
							StatusPasien:   isNew,
							RegisteredTime: enc.RegisteredTime,
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
					
					// 2. Notify Registration Service to update Encounter Status to QUEUED_FOR_POLI
					if res.EncounterNo != "" {
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
