package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/lib/pq"
)

func main() {
	db, err := sql.Open("postgres", "postgresql://root:secretpassword@localhost:5432/simrs_db?sslmode=disable&search_path=auth")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	queries := []string{
		"DROP TABLE IF EXISTS auth.jadwal_praktek CASCADE;",
		"DROP TABLE IF EXISTS auth.mapping_perawat_poli CASCADE;",
		"DROP TABLE IF EXISTS auth.mapping_dokter_poli CASCADE;",
		"DROP TABLE IF EXISTS auth.profil_perawat CASCADE;",
		"DROP TABLE IF EXISTS auth.profil_dokter CASCADE;",
		"UPDATE auth.schema_migrations SET version = 4, dirty = false;",
	}

	for _, q := range queries {
		_, err := db.Exec(q)
		if err != nil {
			fmt.Println("Error executing:", q, err)
		} else {
			fmt.Println("Executed:", q)
		}
	}
}
