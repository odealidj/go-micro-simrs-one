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

	rows, err := db.Query("SELECT id, username, status, created_at FROM auth.users ORDER BY created_at DESC")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	fmt.Println("Users in DB:")
	for rows.Next() {
		var id, username, status, createdAt string
		if err := rows.Scan(&id, &username, &status, &createdAt); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("ID: %s, Username: %s, Status: %s, Created: %s\n", id, username, status, createdAt)
	}
}
