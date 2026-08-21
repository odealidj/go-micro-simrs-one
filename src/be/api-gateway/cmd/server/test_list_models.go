package main

import (
	"context"
	"fmt"
	"log"
	"google.golang.org/genai"
	"google.golang.org/api/iterator"
)

func main() {
	ctx := context.Background()
	client, err := genai.NewClient(ctx, nil)
	if err != nil {
		log.Fatal(err)
	}

	iter := client.Models.List(ctx, nil)
	for {
		m, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println(m.Name)
	}
}
