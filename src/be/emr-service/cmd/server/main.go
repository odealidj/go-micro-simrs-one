package main

import (
	"context"
	"log"
	"net"
	"os"

	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc"

	"github.com/aliube/go-micro-simrs-one/emr-service/internal/adapters/broker"
	grpcAdapter "github.com/aliube/go-micro-simrs-one/emr-service/internal/adapters/grpc"
	"github.com/aliube/go-micro-simrs-one/emr-service/internal/adapters/repository"
	"github.com/aliube/go-micro-simrs-one/emr-service/internal/core/services"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/db"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/outbox"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/telemetry"
	pb "github.com/aliube/go-micro-simrs-one/shared/proto/emr/v1"
)

func main() {
	// 1. Init Telemetry
	jaegerEndpoint := os.Getenv("JAEGER_ENDPOINT")
	if jaegerEndpoint == "" {
		jaegerEndpoint = "localhost:4318"
	}
	
	tp, err := telemetry.InitJaegerTracer("emr-service", jaegerEndpoint)
	if err != nil {
		log.Fatalf("failed to init telemetry: %v", err)
	}
	defer func() {
		if err := tp.Shutdown(nil); err != nil {
			log.Printf("Error shutting down tracer provider: %v", err)
		}
	}()

	// 2. Init Redis Client (for Event Subscriber)
	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "localhost:6379"
	}
	rdb := redis.NewClient(&redis.Options{
		Addr: redisHost,
	})

	// 2. Init Database
	dbConn, err := db.ConnectPostgres("emr")
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer dbConn.Close()

	emrRepo := repository.NewEMRRepository(dbConn)
	emrService := services.NewEMRService(emrRepo)
	
	// 4. Init Event Subscriber
	subscriber := broker.NewRedisSubscriber(rdb, emrService)
	// Start listening to the Registration Events topic
	err = subscriber.StartListening(context.Background(), "registration.events")
	if err != nil {
		log.Fatalf("Failed to start subscriber: %v", err)
	}

	// 5. Init Outbox Relay Worker
	// We need the concrete *repository.emrRepoSqlc type that implements outbox.Repository
	// Luckily, emrRepo is returned as an interface, but we need it to implement outbox.Repository.
	// We can cast it or change how it's returned.
	// Actually we should create a relay
	if outboxRepo, ok := emrRepo.(outbox.Repository); ok {
		emrRelay := outbox.NewRelay(outboxRepo, rdb, "emr_stream")
		go emrRelay.Start(context.Background())
		log.Println("EMR Outbox Relay started")
	} else {
		log.Fatalf("emrRepo does not implement outbox.Repository")
	}

	// 6. Init gRPC Server
	grpcServer := grpc.NewServer()
	emrGrpcHandler := grpcAdapter.NewEMRGrpcServer(emrService)
	
	pb.RegisterEMRServiceServer(grpcServer, emrGrpcHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "50054"
	}

	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("failed to listen on port %s: %v", port, err)
	}

	log.Printf("EMR Service (gRPC) is running on port %s", port)
	if err := grpcServer.Serve(listener); err != nil {
		log.Fatalf("failed to serve gRPC: %v", err)
	}
}
