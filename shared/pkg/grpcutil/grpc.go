package grpcutil

import (
	"context"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// NewGRPCClient creates a new gRPC connection to the specified target.
func NewGRPCClient(target string) (*grpc.ClientConn, error) {
	// For internal microservices, we typically use insecure credentials
	// unless mTLS is explicitly configured.
	opts := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	}
	
	conn, err := grpc.NewClient(target, opts...)
	if err != nil {
		return nil, err
	}
	return conn, nil
}

// ExtractMetadata is a placeholder for interceptors that might extract PASETO 
// tokens from gRPC metadata in incoming requests.
func ExtractMetadata(ctx context.Context) (string, error) {
	// TODO: implement metadata extraction from context
	return "", nil
}
