# SERVICE_NAME must be passed as build-arg (e.g., --build-arg SERVICE_NAME=auth-service)
ARG SERVICE_NAME

FROM golang:alpine AS builder
WORKDIR /app

# Re-declare ARG after FROM so it's available in this stage
ARG SERVICE_NAME

# Install build dependencies
RUN apk add --no-cache git

# Copy go workspace and all module files first for better layer caching
COPY go.work go.work.sum ./
COPY shared/go.mod shared/go.sum ./shared/
COPY api-gateway/go.mod api-gateway/go.sum ./api-gateway/
COPY auth-service/go.mod auth-service/go.sum ./auth-service/
COPY billing-service/go.mod billing-service/go.sum ./billing-service/
COPY emr-service/go.mod emr-service/go.sum ./emr-service/
COPY patient-service/go.mod patient-service/go.sum ./patient-service/
COPY pharmacy-service/go.mod pharmacy-service/go.sum ./pharmacy-service/
COPY registration-service/go.mod registration-service/go.sum ./registration-service/

# Download all dependencies
RUN go work sync

# Copy full source code
COPY . .

# Build the target service binary using package directory
RUN go build -o /out/server ./${SERVICE_NAME}/cmd/server/

# Copy docs if they exist (silently skip if not found)
RUN mkdir -p /out/docs && cp -r ./${SERVICE_NAME}/docs/. /out/docs/ 2>/dev/null || true

# --- Final runtime stage ---
FROM alpine:latest
WORKDIR /app

COPY --from=builder /out/server ./server
COPY --from=builder /out/docs ./docs

CMD ["./server"]
