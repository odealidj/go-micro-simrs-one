FROM golang:alpine AS builder
WORKDIR /app
COPY . .
ARG SERVICE_NAME
RUN go build -o main ./$SERVICE_NAME/cmd/server/main.go
RUN mkdir -p /out/docs && cp -r ./$SERVICE_NAME/docs/* /out/docs/ 2>/dev/null || true
RUN cp main /out/

FROM alpine:latest
WORKDIR /app
COPY --from=builder /out/main .
COPY --from=builder /out/docs ./docs
CMD ["./main"]
