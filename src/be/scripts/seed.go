package main

import (
	"database/sql"
	"fmt"
	"io/ioutil"
	"log"
	"os"

	_ "github.com/lib/pq"
)

func main() {
	db, err := sql.Open("postgres", "postgresql://root:secretpassword@localhost:5432/simrs_db?sslmode=disable")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	filePath := "../scripts/seed_master_data.sql"
	if len(os.Args) > 1 {
		filePath = os.Args[1]
	}

	sqlBytes, err := ioutil.ReadFile(filePath)
	if err != nil {
		log.Fatal(err)
	}

	_, err = db.Exec(string(sqlBytes))
	if err != nil {
		log.Fatal("Error seeding data:", err)
	}
	fmt.Println("Master data seeded successfully.")
}
