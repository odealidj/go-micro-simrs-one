#!/bin/bash
# start-services.sh - Start all local backend services as true background daemons
# Usage: ./start-services.sh [stop]

ROOT="$(cd "$(dirname "$0")" && pwd)"
DB_URL="postgres://root:secretpassword@localhost:5432/simrs_db?sslmode=disable"
REDIS="localhost:6379"
JAEGER="localhost:4318"

declare -A SERVICES=(
  ["auth-service"]="50051"
  ["patient-service"]="50052"
  ["registration-service"]="50053"
  ["medical-record-service"]="50054"
  ["rawat-jalan-service"]="50057"
  ["pharmacy-service"]="50055"
  ["billing-service"]="50056"
)

GOOGLE_API_KEY="${GOOGLE_API_KEY:-}"
if [ -f "$ROOT/.env" ]; then
  GOOGLE_API_KEY=$(grep "^GOOGLE_API_KEY=" "$ROOT/.env" | cut -d= -f2- | tr -d '"')
fi

stop_all() {
  echo "Stopping all services..."
  for port in 50051 50052 50053 50054 50055 50056 50057 8080; do
    PID=$(lsof -t -i :$port -sTCP:LISTEN 2>/dev/null)
    if [ -n "$PID" ]; then
      echo "  Killing port $port (PID $PID)..."
      kill -9 $PID 2>/dev/null || true
    fi
  done
  echo "All stopped."
}

if [ "$1" = "stop" ]; then
  stop_all
  exit 0
fi

stop_all

echo "Building and starting services..."

for SVC in "${!SERVICES[@]}"; do
  PORT="${SERVICES[$SVC]}"
  DIR="$ROOT/src/be/$SVC"
  echo "  Building $SVC..."
  cd "$DIR" && go build -o tmp-main ./cmd/server
  echo "  Starting $SVC on port $PORT..."
  DATABASE_URL="$DB_URL" REDIS_HOST="$REDIS" JAEGER_ENDPOINT="$JAEGER" PORT="$PORT" \
    setsid "$DIR/tmp-main" > "$DIR/run.log" 2>&1 < /dev/null &
  echo $! > "$DIR/run.pid"
done

# Start api-gateway
GW_DIR="$ROOT/src/be/api-gateway"
echo "  Building api-gateway..."
cd "$GW_DIR" && go build -o tmp-main ./cmd/server
echo "  Starting api-gateway on port 8080..."
REDIS_HOST="$REDIS" \
  AUTH_SERVICE_ADDR=localhost:50051 \
  PATIENT_SERVICE_ADDR=localhost:50052 \
  REGISTRATION_SERVICE_ADDR=localhost:50053 \
  MEDICAL_RECORD_SERVICE_ADDR=localhost:50054 \
  EMR_SERVICE_ADDR=localhost:50054 \
  RAWAT_JALAN_SERVICE_ADDR=localhost:50057 \
  PHARMACY_SERVICE_ADDR=localhost:50055 \
  BILLING_SERVICE_ADDR=localhost:50056 \
  PORT=8080 \
  GOOGLE_API_KEY="$GOOGLE_API_KEY" \
  setsid "$GW_DIR/tmp-main" > "$GW_DIR/run.log" 2>&1 < /dev/null &
echo $! > "$GW_DIR/run.pid"

disown -a

echo ""
echo "Waiting for services to start..."
sleep 5

echo ""
echo "Service status:"
for port in 50051 50052 50053 50054 50055 50056 50057 8080; do
  lsof -i :$port -sTCP:LISTEN 2>/dev/null | grep -q LISTEN \
    && echo "  PORT $port: ✓ UP" \
    || echo "  PORT $port: ✗ DOWN"
done
echo ""
echo "Done! Run 'tail -f src/be/auth-service/run.log' to see logs."
