ifneq (,$(wildcard ./.env))
    include .env
    export
endif

DB_URL="postgresql://root:secretpassword@localhost:5432/simrs_db?sslmode=disable"

# Services list
SERVICES = auth-service patient-service registration-service medical-record-service rawat-jalan-service pharmacy-service billing-service

.PHONY: db-up db-down sqlc-generate migrate-up migrate-down db-schemas

db-up:
	podman compose up -d --build

db-down:
	podman compose down

db-schemas:
	@for service in $(SERVICES); do \
		schema=$$(echo $$service | cut -d'-' -f1); \
		if [ "$$service" = "medical-record-service" ]; then schema="medical_record"; fi; \
		if [ "$$service" = "rawat-jalan-service" ]; then schema="rawat_jalan"; fi; \
		echo "Creating schema: $$schema..."; \
		podman exec -i $$(podman ps --filter "name=postgres" -q | head -n 1) psql -U root -d simrs_db -c "CREATE SCHEMA IF NOT EXISTS $$schema;"; \
	done

sqlc-generate:
	@for service in $(SERVICES); do \
		echo "Generating sqlc for $$service..."; \
		cd src/be/$$service && go run github.com/sqlc-dev/sqlc/cmd/sqlc@latest generate && cd ../../..; \
	done

migrate-up:
	@for service in $(SERVICES); do \
		schema=$$(echo $$service | cut -d'-' -f1); \
		if [ "$$service" = "medical-record-service" ]; then schema="medical_record"; fi; \
		if [ "$$service" = "rawat-jalan-service" ]; then schema="rawat_jalan"; fi; \
		echo "Migrating up schema: $$schema..."; \
		go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest -path ./src/be/$$service/internal/adapters/db/migrations -database "$(DB_URL)&search_path=$$schema" up; \
	done

migrate-down:
	@for service in $(SERVICES); do \
		schema=$$(echo $$service | cut -d'-' -f1); \
		if [ "$$service" = "medical-record-service" ]; then schema="medical_record"; fi; \
		if [ "$$service" = "rawat-jalan-service" ]; then schema="rawat_jalan"; fi; \
		echo "Migrating down schema: $$schema..."; \
		go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest -path ./src/be/$$service/internal/adapters/db/migrations -database "$(DB_URL)&search_path=$$schema" down -all; \
	done

# --- New Commands ---

.PHONY: be-run-demo-data be-stop-demo-data
.PHONY: up down be-infra-up be-infra-down be-infra-clean be-run-all be-stop-all be-run-local-all be-stop-local-all
.PHONY: be-run-exporters be-stop-exporters be-run-podman-exporter be-stop-podman-exporter
.PHONY: be-run-local-auth-service be-stop-local-auth-service be-run-local-patient-service be-stop-local-patient-service
.PHONY: be-run-local-registration-service be-stop-local-registration-service be-run-local-medical-record-service be-stop-local-medical-record-service be-run-local-rawat-jalan-service be-stop-local-rawat-jalan-service be-run-local-emr-service be-stop-local-emr-service
.PHONY: be-run-local-pharmacy-service be-stop-local-pharmacy-service be-run-local-billing-service be-stop-local-billing-service
.PHONY: be-run-local-api-gateway be-stop-local-api-gateway
.PHONY: be-run-auth-service be-stop-auth-service be-run-patient-service be-stop-patient-service
.PHONY: be-run-registration-service be-stop-registration-service be-run-medical-record-service be-stop-medical-record-service be-run-rawat-jalan-service be-stop-rawat-jalan-service be-run-emr-service be-stop-emr-service
.PHONY: be-run-pharmacy-service be-stop-pharmacy-service be-run-billing-service be-stop-billing-service
.PHONY: be-run-api-gateway be-stop-api-gateway

up:
	podman compose up -d

down:
	podman compose down

be-infra-up:
	@echo "Starting Podman API socket for container metrics..."
	systemctl --user start podman.socket
	podman compose up -d postgres redis jaeger postgres-exporter redis-exporter podman-exporter 2>&1 | grep -v "no container with" || true
	@echo "Waiting for postgres to be ready..."
	@for i in 1 2 3 4 5 6 7 8 9 10; do \
		if podman exec go-micro-simrs-one_postgres_1 pg_isready -U root -d simrs_db > /dev/null 2>&1; then \
			echo "  Postgres is ready."; break; \
		fi; \
		echo "  Waiting for postgres... ($$i/10)"; sleep 2; \
	done
	@echo "Infra + Exporters (Postgres, Redis, Podman-Exporter) are UP."

be-infra-down:
	@echo "Stopping application containers first (they depend on infra)..."
	-podman compose stop auth-service patient-service registration-service medical-record-service rawat-jalan-service pharmacy-service billing-service api-gateway 2>/dev/null || true
	@echo "Stopping exporters..."
	-podman compose stop postgres-exporter redis-exporter podman-exporter 2>/dev/null || true
	@echo "Removing infra containers (data is preserved in named volumes)..."
	podman compose down postgres redis jaeger
	@echo "Infra stopped. Run 'make be-infra-up' to restart."

be-infra-clean:
	@echo "Force removing ALL simrs containers (emergency cleanup)..."
	-podman ps -a --format "{{.Names}}" | grep "go-micro-simrs-one" | xargs -r podman rm -f 2>/dev/null || true
	@echo "Done. All simrs containers removed. Data volumes are preserved."

be-run-all:
	podman compose up -d --build auth-service patient-service registration-service medical-record-service rawat-jalan-service pharmacy-service billing-service api-gateway

be-stop-all:
	podman compose stop auth-service patient-service registration-service medical-record-service rawat-jalan-service pharmacy-service billing-service api-gateway

be-run-demo-data:
	@echo "Seeding demo data (admin user)..."
	podman exec -i $$(podman ps --filter "name=postgres" -q | head -n 1) psql -U root -d simrs_db < ./src/be/scripts/demo_data_up.sql

be-stop-demo-data:
	@echo "Removing demo data (admin user)..."
	podman exec -i $$(podman ps --filter "name=postgres" -q | head -n 1) psql -U root -d simrs_db < ./src/be/scripts/demo_data_down.sql

# Docker Host Services
be-run-auth-service:
	podman compose up -d auth-service

be-stop-auth-service:
	podman compose stop auth-service

be-run-patient-service:
	podman compose up -d patient-service

be-stop-patient-service:
	podman compose stop patient-service

be-run-registration-service:
	podman compose up -d registration-service

be-stop-registration-service:
	podman compose stop registration-service

be-run-medical-record-service:
	podman compose up -d medical-record-service

be-stop-medical-record-service:
	podman compose stop medical-record-service

be-run-rawat-jalan-service:
	podman compose up -d rawat-jalan-service

be-stop-rawat-jalan-service:
	podman compose stop rawat-jalan-service

be-run-emr-service: be-run-medical-record-service
be-stop-emr-service: be-stop-medical-record-service

be-run-pharmacy-service:
	podman compose up -d pharmacy-service

be-stop-pharmacy-service:
	podman compose stop pharmacy-service

be-run-billing-service:
	podman compose up -d billing-service

be-stop-billing-service:
	podman compose stop billing-service

be-run-api-gateway:
	podman compose up -d api-gateway

be-stop-api-gateway:
	podman compose stop api-gateway

be-run-prometheus:
	podman compose up -d prometheus

be-stop-prometheus:
	podman compose stop prometheus

be-run-podman-exporter:
	systemctl --user start podman.socket
	podman compose up -d podman-exporter

be-stop-podman-exporter:
	podman compose stop podman-exporter

be-run-exporters: be-run-podman-exporter
	podman compose up -d postgres-exporter redis-exporter

be-stop-exporters:
	podman compose stop podman-exporter postgres-exporter redis-exporter


# ============================================================
# Local Host Services (Debugger)
# FIXED: Use port-based kill to reliably stop processes.
#        The old PID-file approach was fragile because:
#          1. 'make' runs each line in a separate subshell,
#             so $! might capture the wrapper shell's PID.
#          2. If run.pid is missing or stale, kill does nothing.
# ============================================================
LOCAL_DB_URL="postgres://root:secretpassword@localhost:5432/simrs_db?sslmode=disable"
LOCAL_REDIS_HOST="localhost:6379"
LOCAL_JAEGER_ENDPOINT="localhost:4318"
LOCAL_PROMETHEUS_URL="http://localhost:9090"

# --- Helper macro: kill ONLY the process LISTENING on a port (not browser clients) ---
define kill_port
	@PORT_PID=$$(lsof -t -i :$(1) -sTCP:LISTEN 2>/dev/null); \
	if [ -n "$$PORT_PID" ]; then \
		echo "  Killing PID $$PORT_PID on port $(1)..."; \
		kill -9 $$PORT_PID 2>/dev/null || true; \
		sleep 0.5; \
	else \
		echo "  Port $(1) is already free."; \
	fi
endef

# --- Helper macro: wait for port to be free then start a service ---
define wait_port_free
	@for i in 1 2 3 4 5; do \
		if ! lsof -i :$(1) > /dev/null 2>&1; then break; fi; \
		echo "  Waiting for port $(1) to be free... ($$i/5)"; \
		sleep 1; \
	done
endef

be-run-local-all: be-run-local-auth-service be-run-local-patient-service be-run-local-registration-service be-run-local-medical-record-service be-run-local-rawat-jalan-service be-run-local-pharmacy-service be-run-local-billing-service be-run-local-api-gateway be-run-local-prometheus

be-stop-local-all: be-stop-local-prometheus be-stop-local-api-gateway be-stop-local-billing-service be-stop-local-pharmacy-service be-stop-local-rawat-jalan-service be-stop-local-medical-record-service be-stop-local-registration-service be-stop-local-patient-service be-stop-local-auth-service
	@echo "All local services stopped."

# ---- auth-service (port 50051) ----
be-run-local-auth-service:
	@echo "Starting local auth-service..."
	@cd src/be/auth-service && go build -o tmp-main cmd/server/main.go
	@cd src/be/auth-service && DATABASE_URL=$(LOCAL_DB_URL) REDIS_HOST=$(LOCAL_REDIS_HOST) JAEGER_ENDPOINT=$(LOCAL_JAEGER_ENDPOINT) PORT=50051 setsid ./tmp-main < /dev/null > run.log 2>&1 & echo $$! > run.pid

be-stop-local-auth-service:
	@echo "Stopping local auth-service..."
	$(call kill_port,50051)
	@rm -f src/be/auth-service/run.pid src/be/auth-service/tmp-main

# ---- patient-service (port 50052) ----
be-run-local-patient-service:
	@echo "Starting local patient-service..."
	@cd src/be/patient-service && go build -o tmp-main cmd/server/main.go
	@cd src/be/patient-service && DATABASE_URL=$(LOCAL_DB_URL) REDIS_HOST=$(LOCAL_REDIS_HOST) JAEGER_ENDPOINT=$(LOCAL_JAEGER_ENDPOINT) PORT=50052 setsid ./tmp-main < /dev/null > run.log 2>&1 & echo $$! > run.pid

be-stop-local-patient-service:
	@echo "Stopping local patient-service..."
	$(call kill_port,50052)
	@rm -f src/be/patient-service/run.pid src/be/patient-service/tmp-main

# ---- registration-service (port 50053) ----
be-run-local-registration-service:
	@echo "Starting local registration-service..."
	@cd src/be/registration-service && go build -o tmp-main cmd/server/main.go
	@cd src/be/registration-service && DATABASE_URL=$(LOCAL_DB_URL) REDIS_HOST=$(LOCAL_REDIS_HOST) JAEGER_ENDPOINT=$(LOCAL_JAEGER_ENDPOINT) PORT=50053 setsid ./tmp-main < /dev/null > run.log 2>&1 & echo $$! > run.pid

be-stop-local-registration-service:
	@echo "Stopping local registration-service..."
	$(call kill_port,50053)
	@rm -f src/be/registration-service/run.pid src/be/registration-service/tmp-main

# ---- medical-record-service (port 50054) ----
be-run-local-medical-record-service:
	@echo "Starting local medical-record-service..."
	@cd src/be/medical-record-service && go build -o tmp-main cmd/server/main.go
	@cd src/be/medical-record-service && DATABASE_URL=$(LOCAL_DB_URL) REDIS_HOST=$(LOCAL_REDIS_HOST) JAEGER_ENDPOINT=$(LOCAL_JAEGER_ENDPOINT) PORT=50054 setsid ./tmp-main < /dev/null > run.log 2>&1 & echo $$! > run.pid

be-stop-local-medical-record-service:
	@echo "Stopping local medical-record-service..."
	$(call kill_port,50054)
	@rm -f src/be/medical-record-service/run.pid src/be/medical-record-service/tmp-main

be-run-local-emr-service: be-run-local-medical-record-service
be-stop-local-emr-service: be-stop-local-medical-record-service

# ---- rawat-jalan-service (port 50057) ----
be-run-local-rawat-jalan-service:
	@echo "Starting local rawat-jalan-service..."
	@cd src/be/rawat-jalan-service && go build -o tmp-main cmd/server/main.go
	@cd src/be/rawat-jalan-service && DATABASE_URL=$(LOCAL_DB_URL) REDIS_HOST=$(LOCAL_REDIS_HOST) JAEGER_ENDPOINT=$(LOCAL_JAEGER_ENDPOINT) PORT=50057 setsid ./tmp-main < /dev/null > run.log 2>&1 & echo $$! > run.pid

be-stop-local-rawat-jalan-service:
	@echo "Stopping local rawat-jalan-service..."
	$(call kill_port,50057)
	@rm -f src/be/rawat-jalan-service/run.pid src/be/rawat-jalan-service/tmp-main

# ---- pharmacy-service (port 50055) ----
be-run-local-pharmacy-service:
	@echo "Starting local pharmacy-service..."
	@cd src/be/pharmacy-service && go build -o tmp-main cmd/server/main.go
	@cd src/be/pharmacy-service && DATABASE_URL=$(LOCAL_DB_URL) REDIS_HOST=$(LOCAL_REDIS_HOST) JAEGER_ENDPOINT=$(LOCAL_JAEGER_ENDPOINT) PORT=50055 setsid ./tmp-main < /dev/null > run.log 2>&1 & echo $$! > run.pid

be-stop-local-pharmacy-service:
	@echo "Stopping local pharmacy-service..."
	$(call kill_port,50055)
	@rm -f src/be/pharmacy-service/run.pid src/be/pharmacy-service/tmp-main

# ---- billing-service (port 50056) ----
be-run-local-billing-service:
	@echo "Starting local billing-service..."
	@cd src/be/billing-service && go build -o tmp-main cmd/server/main.go
	@cd src/be/billing-service && DATABASE_URL=$(LOCAL_DB_URL) REDIS_HOST=$(LOCAL_REDIS_HOST) JAEGER_ENDPOINT=$(LOCAL_JAEGER_ENDPOINT) PORT=50056 setsid ./tmp-main < /dev/null > run.log 2>&1 & echo $$! > run.pid

be-stop-local-billing-service:
	@echo "Stopping local billing-service..."
	$(call kill_port,50056)
	@rm -f src/be/billing-service/run.pid src/be/billing-service/tmp-main

# ---- api-gateway (port 8080) ----
be-run-local-api-gateway:
	@echo "Starting local api-gateway..."
	@cd src/be/api-gateway && go build -o tmp-main ./cmd/server
	@cd src/be/api-gateway && DATABASE_URL=$(LOCAL_DB_URL) REDIS_HOST=$(LOCAL_REDIS_HOST) PROMETHEUS_URL=$(LOCAL_PROMETHEUS_URL) AUTH_SERVICE_ADDR=localhost:50051 PATIENT_SERVICE_ADDR=localhost:50052 REGISTRATION_SERVICE_ADDR=localhost:50053 MEDICAL_RECORD_SERVICE_ADDR=localhost:50054 EMR_SERVICE_ADDR=localhost:50054 RAWAT_JALAN_SERVICE_ADDR=localhost:50057 PHARMACY_SERVICE_ADDR=localhost:50055 BILLING_SERVICE_ADDR=localhost:50056 PORT=8080 GOOGLE_API_KEY=$(GOOGLE_API_KEY) setsid ./tmp-main < /dev/null > run.log 2>&1 & echo $$! > run.pid

be-stop-local-api-gateway:
	@echo "Stopping local api-gateway..."
	$(call kill_port,8080)
	@rm -f src/be/api-gateway/run.pid src/be/api-gateway/tmp-main

# ---- prometheus (port 9090) ----
be-run-local-prometheus:
	@echo "Starting local Prometheus..."
	podman run -d --replace --name simrs-prometheus-local --network host -v $(PWD)/prometheus-local.yml:/etc/prometheus/prometheus.yml docker.io/prom/prometheus:latest

be-stop-local-prometheus:
	@echo "Stopping local Prometheus..."
	podman rm -f simrs-prometheus-local || true


# ============================================================
# Frontend React Services
# ============================================================
.PHONY: fe-react-start fe-react-build fe-react-lint

fe-react-start:
	@echo "Starting React Frontend (Vite) on port 5173..."
	@cd src/fe/react && pnpm dev

fe-react-build:
	@echo "Building React Frontend..."
	@cd src/fe/react && pnpm build

fe-react-lint:
	@echo "Linting React Frontend..."
	@cd src/fe/react && pnpm lint

seed-data-master:
	@echo "Seeding master data..."
	@cd src/be/auth-service && go run ../scripts/seed.go ../scripts/seed_master_data.sql
	@echo "Master data seeded successfully."

reset-data-master:
	@echo "Resetting master data..."
	@cd src/be/auth-service && go run ../scripts/seed.go ../scripts/reset_master_data.sql
	@echo "Master data reset successfully."

.PHONY: reset-transactions
reset-transactions:
	@echo "Resetting transaction data (preserving master data)..."
	podman exec -i $$(podman ps --filter "name=postgres" -q | head -n 1) psql -U root -d simrs_db -c "\
		TRUNCATE TABLE registration.encounters CASCADE; \
		TRUNCATE TABLE registration.outbox_events CASCADE; \
		TRUNCATE TABLE emr.medical_records CASCADE; \
		TRUNCATE TABLE emr.medical_actions CASCADE; \
		TRUNCATE TABLE emr.clinic_wait_time_aggregates CASCADE; \
		TRUNCATE TABLE emr.outbox_events CASCADE; \
		TRUNCATE TABLE pharmacy.prescriptions CASCADE; \
		TRUNCATE TABLE pharmacy.prescription_items CASCADE; \
		TRUNCATE TABLE pharmacy.encounter_payments CASCADE; \
		TRUNCATE TABLE pharmacy.pharmacy_wait_time_aggregates CASCADE; \
		TRUNCATE TABLE pharmacy.outbox_events CASCADE; \
		TRUNCATE TABLE billing.invoices CASCADE; \
		TRUNCATE TABLE billing.invoice_items CASCADE; \
		TRUNCATE TABLE billing.outbox_events CASCADE;"
	@echo "Transaction data reset successfully."
