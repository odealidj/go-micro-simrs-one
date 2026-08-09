package main

import (
	"log"
	"net"
	"os"

	"google.golang.org/grpc"

	grpcAdapter "github.com/aliube/go-micro-simrs-one/billing-service/internal/adapters/grpc"
	"github.com/aliube/go-micro-simrs-one/billing-service/internal/core/services"
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

	// 2. Init Core Services
	// TODO: Replace nil with Postgres Repository later
	billingService := services.NewBillingService(nil)
	
	// 3. Init gRPC Server
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
