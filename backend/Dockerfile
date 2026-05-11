# Multi-stage build for aremko-cli
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates

# Copy dependency files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build for linux/amd64
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -installsuffix cgo -ldflags="-w -s" -o aremko ./cmd/aremko

# Runtime stage - use scratch for minimal image
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy binary
COPY --from=builder /app/aremko ./aremko

# Make executable
RUN chmod +x ./aremko

EXPOSE 8080

CMD ["./aremko", "server", "--port", "8080"]
