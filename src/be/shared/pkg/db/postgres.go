package db

import (
	"database/sql"
	"fmt"
	"os"
	"strconv"
	"time"

	_ "github.com/lib/pq"
)

// ConnectPostgres connects to a PostgreSQL database and sets the search path.
// Connection pool settings can be configured via environment variables:
//   - DB_MAX_OPEN_CONNS (default: 20)
//   - DB_MAX_IDLE_CONNS (default: 5)
//   - DB_CONN_MAX_LIFETIME_MINUTES (default: 60)
func ConnectPostgres(schema string) (*sql.DB, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://root:secretpassword@localhost:5432/simrs_db?sslmode=disable"
	}

	if schema != "" {
		dsn = fmt.Sprintf("%s&search_path=%s", dsn, schema)
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}

	// Pool settings via env vars
	db.SetMaxOpenConns(envInt("DB_MAX_OPEN_CONNS", 20))
	db.SetMaxIdleConns(envInt("DB_MAX_IDLE_CONNS", 5))
	db.SetConnMaxLifetime(time.Duration(envInt("DB_CONN_MAX_LIFETIME_MINUTES", 60)) * time.Minute)

	if err := db.Ping(); err != nil {
		return nil, err
	}

	return db, nil
}

// envInt reads an integer environment variable with a default fallback.
func envInt(key string, defaultVal int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return defaultVal
}
