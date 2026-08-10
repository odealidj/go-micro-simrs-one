package main

import (
	"context"
	"log"
	"net"
	"os"

	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc"

	grpcAdapter "github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/adapters/grpc"
	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/adapters/repository"
	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/core/services"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/db"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/outbox"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/telemetry"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/pharmacy/v1"
)

func main() {
	// 1. Init Telemetry
	jaegerEndpoint := os.Getenv("JAEGER_ENDPOINT")
	if jaegerEndpoint == "" {
		jaegerEndpoint = "localhost:4318"
	}
	
	tp, err := telemetry.InitJaegerTracer("pharmacy-service", jaegerEndpoint)
	if err != nil {
		log.Fatalf("failed to init telemetry: %v", err)
	}
	defer func() {
		if err := tp.Shutdown(nil); err != nil {
			log.Printf("Error shutting down tracer provider: %v", err)
		}
	}()

	// 2. Init Redis Client (for Relay)
	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "localhost:6379"
	}
	rdb := redis.NewClient(&redis.Options{
		Addr: redisHost,
	})

	// 3. Init Database
	dbConn, err := db.ConnectPostgres("pharmacy")
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer dbConn.Close()

	pharmacyRepo := repository.NewPharmacyRepository(dbConn)
	pharmacyService := services.NewPharmacyService(pharmacyRepo)

	// 4. Init Outbox Relay Worker
	if outboxRepo, ok := pharmacyRepo.(outbox.Repository); ok {
		pharmacyRelay := outbox.NewRelay(outboxRepo, rdb, "pharmacy_stream")
		go pharmacyRelay.Start(context.Background())
		log.Println("Pharmacy Outbox Relay started")
	} else {
		log.Fatalf("pharmacyRepo does not implement outbox.Repository")
	}
	
	// 5. Init gRPC Server
	grpcServer := grpc.NewServer()
	pharmacyGrpcHandler := grpcAdapter.NewPharmacyGrpcServer(pharmacyService)
	
	pb.RegisterPharmacyServiceServer(grpcServer, pharmacyGrpcHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "50055"
	}

	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("failed to listen on port %s: %v", port, err)
	}

	log.Printf("Pharmacy Service (gRPC) is running on port %s", port)
	if err := grpcServer.Serve(listener); err != nil {
		log.Fatalf("failed to serve gRPC: %v", err)
	}
}
