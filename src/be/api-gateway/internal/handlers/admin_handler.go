package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/aliube/go-micro-simrs-one/api-gateway/internal/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/db"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/response"
	authpb "github.com/aliube/go-micro-simrs-one/shared/proto/auth/v1"
	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
	"google.golang.org/genai"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health/grpc_health_v1"
)

// GRPCConns holds raw gRPC connections needed only for health-check probes.
// This is the only place in the handler layer where *grpc.ClientConn appears.
type GRPCConns struct {
	Auth         *grpc.ClientConn
	Patient      *grpc.ClientConn
	Registration *grpc.ClientConn
	EMR          *grpc.ClientConn
	Pharmacy     *grpc.ClientConn
	Billing      *grpc.ClientConn
	RawatJalan   *grpc.ClientConn
}

// AdminHandler handles /admin/* routes (role: admin, super_admin).
type AdminHandler struct {
	svc   *ports.ServicePorts
	conns GRPCConns
	rdb   *redis.Client
}

func NewAdminHandler(svc *ports.ServicePorts, conns GRPCConns, rdb *redis.Client) *AdminHandler {
	return &AdminHandler{svc: svc, conns: conns, rdb: rdb}
}

// Register mounts admin routes on r (caller must apply RequireRole middleware).
func (h *AdminHandler) Register(r chi.Router) {
	r.Get("/admin/system/health", h.SystemHealth)
	r.Get("/admin/system/master-metrics", h.MasterMetrics)
	r.Get("/admin/users", h.ListUsers)
	r.Put("/admin/users/{user_id}/status", h.UpdateUserStatus)
	r.Delete("/admin/users/{user_id}", h.DeleteUser)

	// AI Settings
	r.Get("/admin/ai/models", h.GetAIModels)
	r.Get("/admin/ai/settings", h.GetAISettings)
	r.Put("/admin/ai/settings", h.UpdateAISettings)
}

// ── Health ────────────────────────────────────────────────────────────────────

func (h *AdminHandler) checkGRPC(conn *grpc.ClientConn) string {
	client := grpc_health_v1.NewHealthClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
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

func (h *AdminHandler) queryProm(ctx context.Context, query string) string {
	promURL := os.Getenv("PROMETHEUS_URL")
	if promURL == "" {
		promURL = "http://localhost:9090"
	}
	reqURL := promURL + "/api/v1/query?query=" + url.QueryEscape(query)
	rctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(rctx, "GET", reqURL, nil)
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
		if s, ok := val[1].(string); ok {
			if f, err := strconv.ParseFloat(s, 64); err == nil {
				return strconv.FormatFloat(f, 'f', 2, 64)
			}
			return s
		}
	}
	return "N/A"
}

func (h *AdminHandler) queryPromList(ctx context.Context, query string) []map[string]string {
	promURL := os.Getenv("PROMETHEUS_URL")
	if promURL == "" {
		promURL = "http://localhost:9090"
	}
	reqURL := promURL + "/api/v1/query?query=" + url.QueryEscape(query)
	rctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(rctx, "GET", reqURL, nil)
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
			if s, ok := r.Value[1].(string); ok {
				if f, err := strconv.ParseFloat(s, 64); err == nil {
					s = strconv.FormatFloat(f, 'f', 2, 64)
				}
				item := r.Metric
				if item == nil {
					item = make(map[string]string)
				}
				item["value"] = s
				out = append(out, item)
			}
		}
	}
	return out
}

func (h *AdminHandler) SystemHealth(w http.ResponseWriter, r *http.Request) {
	statusData := map[string]interface{}{
		"api_gateway":          "SERVING",
		"auth_service":         h.checkGRPC(h.conns.Auth),
		"patient_service":      h.checkGRPC(h.conns.Patient),
		"registration_service": h.checkGRPC(h.conns.Registration),
		"emr_service":          h.checkGRPC(h.conns.EMR),
		"pharmacy_service":     h.checkGRPC(h.conns.Pharmacy),
		"billing_service":      h.checkGRPC(h.conns.Billing),
	}

	redisStatus := "SERVING"
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := h.rdb.Ping(ctx).Err(); err != nil {
		redisStatus = "DOWN"
	}
	statusData["redis"] = redisStatus

	var emrPending, emrFailed, pharmacyPending, pharmacyFailed int
	if dbConn, err := db.ConnectPostgres(""); err == nil {
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

	statusData["sla_percent"] = h.queryProm(r.Context(), `avg(avg_over_time(up[30d])) * 100`)
	statusData["cpu_usage_percent"] = h.queryProm(r.Context(), `sum(rate(process_cpu_seconds_total[5m])) * 100`)
	statusData["exporter_cpu_percent"] = h.queryProm(r.Context(), `sum(rate(process_cpu_seconds_total{job=~".*exporter.*|podman-exporter"}[5m])) * 100`)
	statusData["ram_usage_mb"] = h.queryProm(r.Context(), `sum(process_resident_memory_bytes) / 1024 / 1024`)
	statusData["exporter_ram_mb"] = h.queryProm(r.Context(), `sum(process_resident_memory_bytes{job=~".*exporter.*|podman-exporter"}) / 1024 / 1024`)
	statusData["http_error_rate"] = h.queryProm(r.Context(), `sum(rate(http_requests_total{code=~"5.."}[5m])) or vector(0)`)
	statusData["microservices_cpu"] = h.queryPromList(r.Context(), `sum by (job) (rate(process_cpu_seconds_total{job!~".*exporter.*|podman-exporter"}[5m])) * 100`)
	statusData["microservices_ram"] = h.queryPromList(r.Context(), `sum by (job) (process_resident_memory_bytes{job!~".*exporter.*|podman-exporter"}) / 1024 / 1024`)
	statusData["redis_connected_clients"] = h.queryProm(r.Context(), `redis_connected_clients or vector(0)`)
	statusData["redis_memory_used_mb"] = h.queryProm(r.Context(), `redis_memory_used_bytes / 1024 / 1024 or vector(0)`)
	statusData["pg_active_connections"] = h.queryProm(r.Context(), `sum(pg_stat_activity_count) or vector(0)`)
	statusData["pg_xact_commit"] = h.queryProm(r.Context(), `sum(rate(pg_stat_database_xact_commit[5m])) or vector(0)`)
	statusData["db_hw_cpu"] = h.queryPromList(r.Context(), `rate(podman_container_cpu_seconds_total[5m]) * 100 * on(id) group_left(name) podman_container_info{name=~".*(go-micro-simrs-one_postgres_|go-micro-simrs-one_redis_).*"}`)
	statusData["db_hw_ram"] = h.queryPromList(r.Context(), `podman_container_mem_usage_bytes * on(id) group_left(name) podman_container_info{name=~".*(go-micro-simrs-one_postgres_|go-micro-simrs-one_redis_).*"} / 1024 / 1024`)

	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "System health check completed", Data: statusData})
}

func (h *AdminHandler) MasterMetrics(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	dbConn, err := db.ConnectPostgres("")
	if err != nil {
		response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "database connection failed"})
		return
	}
	defer dbConn.Close()

	var totalKbm, totalIcd10, totalTindakan, unmappedKbm, totalObat, activeUsers, todayEncounter int
	dbConn.QueryRowContext(ctx, "SELECT COUNT(*) FROM emr.kbm_catalog").Scan(&totalKbm)
	dbConn.QueryRowContext(ctx, "SELECT COUNT(*) FROM emr.icd10_catalog").Scan(&totalIcd10)
	dbConn.QueryRowContext(ctx, "SELECT COUNT(*) FROM emr.master_tindakan").Scan(&totalTindakan)
	dbConn.QueryRowContext(ctx, "SELECT COUNT(*) FROM emr.kbm_catalog WHERE kbm_code NOT IN (SELECT kbm_code FROM emr.kbm_icd10_mappings)").Scan(&unmappedKbm)
	dbConn.QueryRowContext(ctx, "SELECT COUNT(*) FROM pharmacy.inventory").Scan(&totalObat)
	dbConn.QueryRowContext(ctx, "SELECT COUNT(*) FROM auth.users WHERE status = 'ACTIVE'").Scan(&activeUsers)
	dbConn.QueryRowContext(ctx, "SELECT COUNT(*) FROM registration.encounters WHERE DATE(created_at) = CURRENT_DATE").Scan(&todayEncounter)

	response.JSON(w, http.StatusOK, response.SuccessResponse{
		Success: true,
		Message: "Master metrics fetched",
		Data: map[string]interface{}{
			"total_kbm": totalKbm, "total_icd10": totalIcd10, "total_tindakan": totalTindakan,
			"unmapped_kbm": unmappedKbm, "total_obat": totalObat,
			"active_users": activeUsers, "today_encounter": todayEncounter,
		},
	})
}

func (h *AdminHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page <= 0 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	if pageSize <= 0 {
		pageSize = 50
	}
	res, err := h.svc.Auth.ListUsers(r.Context(), &authpb.ListUsersRequest{
		Page:         int32(page),
		PageSize:     int32(pageSize),
		StatusFilter: r.URL.Query().Get("status"),
		Search:       r.URL.Query().Get("search"),
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *AdminHandler) UpdateUserStatus(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "user_id")
	var payload struct {
		Status string `json:"status"`
		Role   string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	res, err := h.svc.Auth.UpdateUserStatus(r.Context(), &authpb.UpdateUserStatusRequest{
		UserId: userID, Status: payload.Status, Role: payload.Role,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *AdminHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.Auth.DeleteUser(r.Context(), &authpb.DeleteUserRequest{UserId: chi.URLParam(r, "user_id")})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

// ── AI Settings ──────────────────────────────────────────────────────────────

func (h *AdminHandler) GetAIModels(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	fallbackModels := []string{
		"gemini-2.5-flash",
		"gemini-2.5-pro",
		"gemini-3.6-flash",
		"gemini-3.7-flash",
		"gemini-1.5-flash",
		"gemini-1.5-pro",
	}

	client, err := genai.NewClient(ctx, nil)
	if err != nil {
		log.Printf("WARN: Failed to create GenAI client: %v. Returning fallback models.", err)
		response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Fallback models returned", Data: fallbackModels})
		return
	}

	page, err := client.Models.List(ctx, nil)
	if err != nil {
		log.Printf("WARN: Failed to list GenAI models: %v. Returning fallback models.", err)
		response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Fallback models returned", Data: fallbackModels})
		return
	}

	var models []string
	for _, m := range page.Items {
		name := strings.TrimPrefix(m.Name, "models/")
		if strings.HasPrefix(name, "gemini") || strings.HasPrefix(name, "gemma") {
			models = append(models, name)
		}
	}
	if len(models) == 0 {
		models = fallbackModels
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: models})
}

func (h *AdminHandler) GetAISettings(w http.ResponseWriter, r *http.Request) {
	dbConn, dbErr := db.ConnectPostgres("")
	var modelName string
	var err error
	if dbErr == nil {
		defer dbConn.Close()
		err = dbConn.QueryRowContext(r.Context(), "SELECT value FROM auth.system_settings WHERE key = $1", "gemini_ocr_model").Scan(&modelName)
	} else {
		err = dbErr
	}
	if err != nil {
		modelName = "gemini-3.6-flash" // default fallback
	}
	data := map[string]string{"gemini_ocr_model": modelName}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: data})
}

func (h *AdminHandler) UpdateAISettings(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		ModelName string `json:"gemini_ocr_model"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
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

	_, err := dbConn.ExecContext(r.Context(), `
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
}

