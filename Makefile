DB_URL="postgresql://root:secretpassword@localhost:5432/simrs_db?sslmode=disable"

# Services list
SERVICES = auth-service patient-service registration-service emr-service pharmacy-service billing-service

.PHONY: db-up db-down sqlc-generate migrate-up migrate-down db-schemas

db-up:
	docker compose up -d

db-down:
	docker compose down

db-schemas:
	@for service in $(SERVICES); do \
		schema=$$(echo $$service | cut -d'-' -f1); \
		echo "Creating schema: $$schema..."; \
		docker exec -i $$(docker compose ps -q postgres) psql -U root -d simrs_db -c "CREATE SCHEMA IF NOT EXISTS $$schema;"; \
	done

sqlc-generate:
	@for service in $(SERVICES); do \
		echo "Generating sqlc for $$service..."; \
		cd $$service && go run github.com/sqlc-dev/sqlc/cmd/sqlc@latest generate && cd ..; \
	done

migrate-up:
	@for service in $(SERVICES); do \
		schema=$$(echo $$service | cut -d'-' -f1); \
		echo "Migrating up schema: $$schema..."; \
		go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest -path ./$$service/internal/adapters/db/migrations -database "$(DB_URL)&search_path=$$schema" up; \
	done

migrate-down:
	@for service in $(SERVICES); do \
		schema=$$(echo $$service | cut -d'-' -f1); \
		echo "Migrating down schema: $$schema..."; \
		go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest -path ./$$service/internal/adapters/db/migrations -database "$(DB_URL)&search_path=$$schema" down -all; \
	done
