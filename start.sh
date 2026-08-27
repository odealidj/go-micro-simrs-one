#!/bin/bash
if [ -f ~/.env ]; then
  export $(grep -v '^#' ~/.env | xargs)
fi

cd src/be/auth-service && DATABASE_URL=postgres://simrs_user:simrs_pass@localhost:5432/simrs_db?sslmode=disable REDIS_HOST=localhost:6379 JAEGER_ENDPOINT=http://localhost:14268/api/traces PORT=50051 ./tmp-main > run.log 2>&1 &
cd ../patient-service && DATABASE_URL=postgres://simrs_user:simrs_pass@localhost:5432/simrs_db?sslmode=disable REDIS_HOST=localhost:6379 JAEGER_ENDPOINT=http://localhost:14268/api/traces PORT=50052 ./tmp-main > run.log 2>&1 &
cd ../registration-service && DATABASE_URL=postgres://simrs_user:simrs_pass@localhost:5432/simrs_db?sslmode=disable REDIS_HOST=localhost:6379 JAEGER_ENDPOINT=http://localhost:14268/api/traces PORT=50053 ./tmp-main > run.log 2>&1 &
cd ../medical-record-service && DATABASE_URL=postgres://simrs_user:simrs_pass@localhost:5432/simrs_db?sslmode=disable REDIS_HOST=localhost:6379 JAEGER_ENDPOINT=http://localhost:14268/api/traces PORT=50054 ./tmp-main > run.log 2>&1 &
cd ../rawat-jalan-service && DATABASE_URL=postgres://simrs_user:simrs_pass@localhost:5432/simrs_db?sslmode=disable REDIS_HOST=localhost:6379 JAEGER_ENDPOINT=http://localhost:14268/api/traces PORT=50057 ./tmp-main > run.log 2>&1 &
cd ../pharmacy-service && DATABASE_URL=postgres://simrs_user:simrs_pass@localhost:5432/simrs_db?sslmode=disable REDIS_HOST=localhost:6379 JAEGER_ENDPOINT=http://localhost:14268/api/traces PORT=50055 ./tmp-main > run.log 2>&1 &
cd ../billing-service && DATABASE_URL=postgres://simrs_user:simrs_pass@localhost:5432/simrs_db?sslmode=disable REDIS_HOST=localhost:6379 JAEGER_ENDPOINT=http://localhost:14268/api/traces PORT=50056 ./tmp-main > run.log 2>&1 &
cd ../api-gateway && AUTH_SERVICE_ADDR=localhost:50051 PATIENT_SERVICE_ADDR=localhost:50052 REGISTRATION_SERVICE_ADDR=localhost:50053 MEDICAL_RECORD_SERVICE_ADDR=localhost:50054 EMR_SERVICE_ADDR=localhost:50054 RAWAT_JALAN_SERVICE_ADDR=localhost:50057 PHARMACY_SERVICE_ADDR=localhost:50055 BILLING_SERVICE_ADDR=localhost:50056 PORT=8080 ./tmp-main > run.log 2>&1 &
echo "Started all services"
