# Build stage - usar debian en lugar de alpine
FROM golang:1.23-bullseye AS builder

WORKDIR /app

# Copy dependency files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build static binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -a -installsuffix cgo \
    -ldflags="-w -s" \
    -o aremko \
    ./cmd/aremko

# Runtime stage - debian slim
FROM debian:bullseye-slim

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /root/

# Copy binary
COPY --from=builder /app/aremko ./aremko

# Make executable
RUN chmod +x ./aremko

EXPOSE 8080

CMD ["./aremko", "server", "--port", "8080"]
