# Build stage - usar debian con Go 1.25
FROM golang:1.25-bullseye AS builder

# Install file command for diagnostics
RUN apt-get update && apt-get install -y file && rm -rf /var/lib/apt/lists/*

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
    .

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

# Use absolute path - port will be read from PORT env var
CMD ["/root/aremko", "server"]
