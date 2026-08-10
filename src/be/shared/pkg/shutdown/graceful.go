// Package shutdown provides utilities for graceful shutdown of services.
package shutdown

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"
)

// WaitForSignal blocks until an OS termination signal is received (SIGTERM or SIGINT).
// It returns a context that is cancelled upon receiving the signal.
func WaitForSignal() (context.Context, context.CancelFunc) {
	ctx, cancel := context.WithCancel(context.Background())

	go func() {
		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		sig := <-quit
		slog.Info("Shutdown signal received", "signal", sig.String())
		cancel()
	}()

	return ctx, cancel
}

// GracefulTimeout is the maximum duration to wait for in-flight requests to finish.
const GracefulTimeout = 10 * time.Second
