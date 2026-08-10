DB_URL="postgresql://root:secretpassword@localhost:5432/simrs_db?sslmode=disable"

# Services list
SERVICES = auth-service patient-service registration-service emr-service pharmacy-service billing-service

.PHONY: db-up db-down sqlc-generate migrate-up migrate-down db-schemas

db-up:
	podman compose up -d --build

db-down:
	podman compose down

db-schemas:
	@for service in $(SERVICES); do \
		schema=$$(echo $$service | cut -d'-' -f1); \
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
		echo "Migrating up schema: $$schema..."; \
		go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest -path ./src/be/$$service/internal/adapters/db/migrations -database "$(DB_URL)&search_path=$$schema" up; \
	done

migrate-down:
	@for service in $(SERVICES); do \
		schema=$$(echo $$service | cut -d'-' -f1); \
		echo "Migrating down schema: $$schema..."; \
		go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest -path ./src/be/$$service/internal/adapters/db/migrations -database "$(DB_URL)&search_path=$$schema" down -all; \
	done

# --- New Commands ---

.PHONY: up down be-infra-up be-infra-down be-run-all be-stop-all be-run-local-all be-stop-local-all
.PHONY: be-run-local-auth-service be-stop-local-auth-service be-run-local-patient-service be-stop-local-patient-service
.PHONY: be-run-local-registration-service be-stop-local-registration-service be-run-local-emr-service be-stop-local-emr-service
.PHONY: be-run-local-pharmacy-service be-stop-local-pharmacy-service be-run-local-billing-service be-stop-local-billing-service
.PHONY: be-run-local-api-gateway be-stop-local-api-gateway
.PHONY: be-run-auth-service be-stop-auth-service be-run-patient-service be-stop-patient-service
.PHONY: be-run-registration-service be-stop-registration-service be-run-emr-service be-stop-emr-service
.PHONY: be-run-pharmacy-service be-stop-pharmacy-service be-run-billing-service be-stop-billing-service
.PHONY: be-run-api-gateway be-stop-api-gateway

up:
	podman compose up -d

down:
	podman compose down

be-infra-up:
	podman compose up -d postgres redis jaeger

be-infra-down:
	podman compose stop postgres redis jaeger

be-run-all:
	podman compose up -d --build auth-service patient-service registration-service emr-service pharmacy-service billing-service api-gateway

be-stop-all:
	podman compose stop auth-service patient-service registration-service emr-service pharmacy-service billing-service api-gateway

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

be-run-emr-service:
	podman compose up -d emr-service

be-stop-emr-service:
	podman compose stop emr-service

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


# Local Host Services (Debugger)
LOCAL_DB_URL="postgres://root:secretpassword@localhost:5432/simrs_db?sslmode=disable"
LOCAL_REDIS_HOST="localhost:6379"
LOCAL_JAEGER_ENDPOINT="localhost:4318"

be-run-local-all: be-run-local-auth-service be-run-local-patient-service be-run-local-registration-service be-run-local-emr-service be-run-local-pharmacy-service be-run-local-billing-service be-run-local-api-gateway

be-stop-local-all: be-stop-local-auth-service be-stop-local-patient-service be-stop-local-registration-service be-stop-local-emr-service be-stop-local-pharmacy-service be-stop-local-billing-service be-stop-local-api-gateway

be-run-local-auth-service:
	@echo "Starting local auth-service..."
	@cd src/be/auth-service && go build -o tmp-main cmd/server/main.go
	@cd src/be/auth-service && DATABASE_URL=$(LOCAL_DB_URL) REDIS_HOST=$(LOCAL_REDIS_HOST) JAEGER_ENDPOINT=$(LOCAL_JAEGER_ENDPOINT) PORT=50051 ./tmp-main > run.log 2>&1 & echo $$! > run.pid

be-stop-local-auth-service:
	@echo "Stopping local auth-service..."
	@cd src/be/auth-service && if [ -f run.pid ]; then kill `cat run.pid` || true; rm -f run.pid tmp-main; fi

be-run-local-patient-service:
	@echo "Starting local patient-service..."
	@cd src/be/patient-service && go build -o tmp-main cmd/server/main.go
	@cd src/be/patient-service && DATABASE_URL=$(LOCAL_DB_URL) REDIS_HOST=$(LOCAL_REDIS_HOST) JAEGER_ENDPOINT=$(LOCAL_JAEGER_ENDPOINT) PORT=50052 ./tmp-main > run.log 2>&1 & echo $$! > run.pid

be-stop-local-patient-service:
	@echo "Stopping local patient-service..."
	@cd src/be/patient-service && if [ -f run.pid ]; then kill `cat run.pid` || true; rm -f run.pid tmp-main; fi

be-run-local-registration-service:
	@echo "Starting local registration-service..."
	@cd src/be/registration-service && go build -o tmp-main cmd/server/main.go
	@cd src/be/registration-service && DATABASE_URL=$(LOCAL_DB_URL) REDIS_HOST=$(LOCAL_REDIS_HOST) JAEGER_ENDPOINT=$(LOCAL_JAEGER_ENDPOINT) PORT=50053 ./tmp-main > run.log 2>&1 & echo $$! > run.pid

be-stop-local-registration-service:
	@echo "Stopping local registration-service..."
	@cd src/be/registration-service && if [ -f run.pid ]; then kill `cat run.pid` || true; rm -f run.pid tmp-main; fi

be-run-local-emr-service:
	@echo "Starting local emr-service..."
	@cd src/be/emr-service && go build -o tmp-main cmd/server/main.go
	@cd src/be/emr-service && DATABASE_URL=$(LOCAL_DB_URL) REDIS_HOST=$(LOCAL_REDIS_HOST) JAEGER_ENDPOINT=$(LOCAL_JAEGER_ENDPOINT) PORT=50054 ./tmp-main > run.log 2>&1 & echo $$! > run.pid

be-stop-local-emr-service:
	@echo "Stopping local emr-service..."
	@cd src/be/emr-service && if [ -f run.pid ]; then kill `cat run.pid` || true; rm -f run.pid tmp-main; fi

be-run-local-pharmacy-service:
	@echo "Starting local pharmacy-service..."
	@cd src/be/pharmacy-service && go build -o tmp-main cmd/server/main.go
	@cd src/be/pharmacy-service && DATABASE_URL=$(LOCAL_DB_URL) REDIS_HOST=$(LOCAL_REDIS_HOST) JAEGER_ENDPOINT=$(LOCAL_JAEGER_ENDPOINT) PORT=50055 ./tmp-main > run.log 2>&1 & echo $$! > run.pid

be-stop-local-pharmacy-service:
	@echo "Stopping local pharmacy-service..."
	@cd src/be/pharmacy-service && if [ -f run.pid ]; then kill `cat run.pid` || true; rm -f run.pid tmp-main; fi

be-run-local-billing-service:
	@echo "Starting local billing-service..."
	@cd src/be/billing-service && go build -o tmp-main cmd/server/main.go
	@cd src/be/billing-service && DATABASE_URL=$(LOCAL_DB_URL) REDIS_HOST=$(LOCAL_REDIS_HOST) JAEGER_ENDPOINT=$(LOCAL_JAEGER_ENDPOINT) PORT=50056 ./tmp-main > run.log 2>&1 & echo $$! > run.pid

be-stop-local-billing-service:
	@echo "Stopping local billing-service..."
	@cd src/be/billing-service && if [ -f run.pid ]; then kill `cat run.pid` || true; rm -f run.pid tmp-main; fi

be-run-local-api-gateway:
	@echo "Starting local api-gateway..."
	@cd src/be/api-gateway && go build -o tmp-main cmd/server/main.go
	@cd src/be/api-gateway && AUTH_SERVICE_ADDR=localhost:50051 REGISTRATION_SERVICE_ADDR=localhost:50053 PORT=8080 ./tmp-main > run.log 2>&1 & echo $$! > run.pid

be-stop-local-api-gateway:
	@echo "Stopping local api-gateway..."
	@cd src/be/api-gateway && if [ -f run.pid ]; then kill `cat run.pid` || true; rm -f run.pid tmp-main; fi
