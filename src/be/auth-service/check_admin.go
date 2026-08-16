package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/lib/pq"
)

func main() {
	dbURL := "postgresql://root:secretpassword@localhost:5432/simrs_db?sslmode=disable"
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	var role sql.NullString
	err = db.QueryRow("SELECT role FROM auth.users WHERE username = 'admin'").Scan(&role)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("Admin role is:", role.String)
}
