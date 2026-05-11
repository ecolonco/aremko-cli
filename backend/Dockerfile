# Build stage - usar debian con Go 1.24
FROM golang:1.24-bullseye AS builder

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

# Verify binary was built correctly
RUN file aremko && ls -lh aremko

# Runtime stage - debian slim
FROM debian:bullseye-slim

RUN apt-get update && apt-get install -y ca-certificates file && rm -rf /var/lib/apt/lists/*

WORKDIR /root/

# Copy binary
COPY --from=builder /app/aremko ./aremko

# Make executable
RUN chmod +x ./aremko

# Verify binary in runtime stage
RUN file ./aremko && ldd ./aremko || true

EXPOSE 8080

# Use absolute path and verify before running
CMD ["/root/aremko", "server", "--port", "8080"]
