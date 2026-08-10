package main

import (
	"log"
	"net"
	"os"

	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc"

	grpcAdapter "github.com/aliube/go-micro-simrs-one/patient-service/internal/adapters/grpc"
	"github.com/aliube/go-micro-simrs-one/patient-service/internal/adapters/repository"
	"github.com/aliube/go-micro-simrs-one/patient-service/internal/core/services"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/db"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/telemetry"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/patient/v1"
)

func main() {
	// 1. Init Telemetry
	jaegerEndpoint := os.Getenv("JAEGER_ENDPOINT")
	if jaegerEndpoint == "" {
		jaegerEndpoint = "localhost:4318"
	}
	
	tp, err := telemetry.InitJaegerTracer("patient-service", jaegerEndpoint)
	if err != nil {
		log.Fatalf("failed to init telemetry: %v", err)
	}
	defer func() {
		if err := tp.Shutdown(nil); err != nil {
			log.Printf("Error shutting down tracer provider: %v", err)
		}
	}()

	// 2. Init Redis Client (for MRN atomic increment)
	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "localhost:6379"
	}
	rdb := redis.NewClient(&redis.Options{
		Addr: redisHost,
	})

	// 3. Init Database
	dbConn, err := db.ConnectPostgres("patient")
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer dbConn.Close()

	patientRepo := repository.NewPatientRepository(dbConn)
	patientService := services.NewPatientService(patientRepo, rdb)
	
	// 4. Init gRPC Server
	grpcServer := grpc.NewServer()
	patientGrpcHandler := grpcAdapter.NewPatientGrpcServer(patientService)
	
	pb.RegisterPatientServiceServer(grpcServer, patientGrpcHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "50052"
	}

	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("failed to listen on port %s: %v", port, err)
	}

	log.Printf("Patient Service (gRPC) is running on port %s", port)
	if err := grpcServer.Serve(listener); err != nil {
		log.Fatalf("failed to serve gRPC: %v", err)
	}
}
