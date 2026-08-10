package main

import (
	"context"
	"log"
	"net"
	"os"

	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc"

	grpcAdapter "github.com/aliube/go-micro-simrs-one/billing-service/internal/adapters/grpc"
	"github.com/aliube/go-micro-simrs-one/billing-service/internal/adapters/repository"
	"github.com/aliube/go-micro-simrs-one/billing-service/internal/core/services"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/db"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/outbox"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/telemetry"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/billing/v1"
)

func main() {
	// 1. Init Telemetry
	jaegerEndpoint := os.Getenv("JAEGER_ENDPOINT")
	if jaegerEndpoint == "" {
		jaegerEndpoint = "localhost:4318"
	}
	
	tp, err := telemetry.InitJaegerTracer("billing-service", jaegerEndpoint)
	if err != nil {
		log.Fatalf("failed to init telemetry: %v", err)
	}
	defer func() {
		if err := tp.Shutdown(nil); err != nil {
			log.Printf("Error shutting down tracer provider: %v", err)
		}
	}()

	// 2. Init Redis Client (for Relay & Consumer)
	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "localhost:6379"
	}
	rdb := redis.NewClient(&redis.Options{
		Addr: redisHost,
	})

	// 3. Init Database
	dbConn, err := db.ConnectPostgres("billing")
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer dbConn.Close()

	billingRepo := repository.NewBillingRepository(dbConn)
	billingService := services.NewBillingService(billingRepo)
	
	// 4. Init Outbox Relay Worker (For outgoing events like InvoicePaid)
	if outboxRepo, ok := billingRepo.(outbox.Repository); ok {
		billingRelay := outbox.NewRelay(outboxRepo, rdb, "billing_stream")
		go billingRelay.Start(context.Background())
		log.Println("Billing Outbox Relay started")
	} else {
		log.Fatalf("billingRepo does not implement outbox.Repository")
	}

	// 5. Start Consumers (Listening to EMR and Pharmacy streams)
	services.StartBillingConsumers(context.Background(), rdb, billingService)

	// 6. Init gRPC Server
	grpcServer := grpc.NewServer()
	billingGrpcHandler := grpcAdapter.NewBillingGrpcServer(billingService)
	
	pb.RegisterBillingServiceServer(grpcServer, billingGrpcHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "50056"
	}

	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("failed to listen on port %s: %v", port, err)
	}

	log.Printf("Billing Service (gRPC) is running on port %s", port)
	if err := grpcServer.Serve(listener); err != nil {
		log.Fatalf("failed to serve gRPC: %v", err)
	}
}
