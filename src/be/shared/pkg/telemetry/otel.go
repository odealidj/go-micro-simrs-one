package telemetry

import (
	"context"
	"log/slog"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.17.0"
)

// InitJaegerTracer initializes an OpenTelemetry tracer provider that exports to Jaeger via OTLP.
func InitJaegerTracer(serviceName string, jaegerEndpoint string) (*sdktrace.TracerProvider, error) {
	ctx := context.Background()

	// 1. Create the Jaeger OTLP exporter
	// We use insecure here for local development. In production, configure TLS.
	exporter, err := otlptracehttp.New(ctx, 
		otlptracehttp.WithEndpoint(jaegerEndpoint),
		otlptracehttp.WithInsecure(),
	)
	if err != nil {
		return nil, err
	}

	// 2. Define the resource (service name and attributes)
	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(serviceName),
		),
	)
	if err != nil {
		return nil, err
	}

	// 3. Create the Tracer Provider
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter,
			sdktrace.WithMaxExportBatchSize(100),
			sdktrace.WithBatchTimeout(time.Second*5),
		),
		sdktrace.WithResource(res),
	)

	// Set the global TracerProvider and TextMapPropagator
	otel.SetTracerProvider(tp)
	
	// Ensure that context propagation works across boundaries (HTTP/gRPC)
	// For standard trace propagation, we should set up W3C TraceContext and Baggage.
	// We'll keep it simple here.

	slog.Info("Jaeger (OTel) Tracer initialized", "service", serviceName)
	return tp, nil
}
