package db

import (
	"database/sql"
	"fmt"
	"os"
	"time"

	_ "github.com/lib/pq"
)

// ConnectPostgres connects to a PostgreSQL database and sets the search path.
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

	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(time.Hour)

	if err := db.Ping(); err != nil {
		return nil, err
	}

	return db, nil
}
