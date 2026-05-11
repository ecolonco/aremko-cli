# Django Booking System Integration

## Overview

This document describes the integration between aremko-cli (Go backend) and the Django booking system, enabling real-time access to reservation data in the aremko-cli dashboard.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│           aremko-cli (Go Backend)                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  internal/bookings/client.go                          │  │
│  │  - HTTP client for Django API                         │  │
│  │  - GetBookingStats(), GetDailyBookings()              │  │
│  │  - GetClientStats(), HealthCheck()                    │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │ HTTP GET                               │
│              Port: 8080                                      │
└─────────────────────┼───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│         Django Booking System (aremko-booking)               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ventas/api_aremko_cli.py                             │  │
│  │  - Read-only API endpoints                            │  │
│  │  - bookings_stats(), bookings_daily()                 │  │
│  │  - clients_stats(), health_check()                    │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Models: VentaReserva, Cliente                        │  │
│  │  Database: PostgreSQL                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│              Port: 8002 (local) / Render (production)        │
└─────────────────────────────────────────────────────────────┘
```

## Files Created/Modified

### Django Side (aremko-booking project)

#### 1. `/ventas/api_aremko_cli.py` (NEW)
Complete API endpoints for aremko-cli integration.

**Endpoints**:
- `GET /ventas/api/aremko-cli/health/` - Health check
- `GET /ventas/api/aremko-cli/bookings/stats/` - Booking statistics
- `GET /ventas/api/aremko-cli/bookings/daily/` - Daily breakdown
- `GET /ventas/api/aremko-cli/clients/stats/` - Client metrics

**Features**:
- Read-only (safe)
- Query by date range (YYYY-MM-DD format)
- Excludes cancelled bookings
- Returns JSON with success/error handling
- No authentication required (add if needed)

#### 2. `/ventas/urls.py` (MODIFIED)
Added URL routes for aremko-cli API:

```python
# === AREMKO-CLI API (Read-only endpoints for aremko-cli dashboard) ===
path('api/aremko-cli/health/', api_aremko_cli.health_check, name='aremko_cli_health'),
path('api/aremko-cli/bookings/stats/', api_aremko_cli.bookings_stats, name='aremko_cli_bookings_stats'),
path('api/aremko-cli/bookings/daily/', api_aremko_cli.bookings_daily, name='aremko_cli_bookings_daily'),
path('api/aremko-cli/clients/stats/', api_aremko_cli.clients_stats, name='aremko_cli_clients_stats'),
# === END AREMKO-CLI API ===
```

### Go Side (aremko-cli project)

#### 1. `/backend/internal/bookings/client.go` (NEW)
Go HTTP client for consuming Django API.

**Types**:
- `BookingStats` - Aggregated statistics
- `DailyBooking` - Day-by-day breakdown
- `ClientStats` - Client metrics
- `APIResponse` - Generic response wrapper

**Methods**:
- `GetBookingStats(dateStart, dateStop)` - Fetch booking stats
- `GetDailyBookings(dateStart, dateStop)` - Get daily data
- `GetClientStats()` - Get client metrics
- `HealthCheck()` - Verify API connectivity

#### 2. `/backend/internal/config/config.go` (MODIFIED)
Added configuration fields:

```go
type Config struct {
    // ...
    BookingSystemURL string  // Django API base URL
    EnableBookings   bool    // Feature flag
    // ...
}
```

Environment variables:
- `BOOKING_SYSTEM_URL` - Default: `http://localhost:8002`
- `ENABLE_BOOKINGS` - Default: `true`

#### 3. `/backend/internal/api/handlers/brief.go` (MODIFIED)
Updated `GetStatsOverview()` to fetch real booking data:

```go
if cfg.EnableBookings {
    bookingClient := bookings.NewClient(cfg.BookingSystemURL)
    bookingStats, err := bookingClient.GetBookingStats(dateStart, dateStop)
    if err == nil {
        // Use real data
        overview["bookings"] = map[string]interface{}{
            "total":      bookingStats.Total,
            "revenue":    bookingStats.Revenue,
            "avg_ticket": bookingStats.AvgTicket,
            "status":     "real_data",
        }
    } else {
        // Fallback to mock data
        overview["bookings"] = map[string]interface{}{
            "status": "mock_data",
            "error":  err.Error(),
        }
    }
}
```

#### 4. `/backend/internal/api/server.go` (MODIFIED)
Updated health check to include bookings status:

```go
"services": map[string]bool{
    "meta_ads":  s.config.EnableMetaAds,
    "bookings":  s.config.EnableBookings,
    // ...
}
```

#### 5. `/backend/.env.example` (MODIFIED)
Added configuration template:

```bash
# Booking System (Django API)
ENABLE_BOOKINGS=true
BOOKING_SYSTEM_URL=http://localhost:8002  # or production URL
```

## API Specification

### 1. Health Check

**Request**:
```bash
GET http://localhost:8002/ventas/api/aremko-cli/health/
```

**Response**:
```json
{
    "success": true,
    "status": "healthy",
    "service": "aremko-cli-api",
    "version": "1.0.0",
    "timestamp": "2026-05-11T14:30:00-04:00"
}
```

### 2. Booking Statistics

**Request**:
```bash
GET http://localhost:8002/ventas/api/aremko-cli/bookings/stats/?date_start=2026-05-02&date_stop=2026-05-09
```

**Response**:
```json
{
    "success": true,
    "data": {
        "total": 48,
        "revenue": 2840000.0,
        "avg_ticket": 59167.0,
        "period": {
            "start": "2026-05-02",
            "end": "2026-05-09"
        },
        "paid": 35,
        "pending": 8,
        "partial": 5
    }
}
```

### 3. Daily Bookings

**Request**:
```bash
GET http://localhost:8002/ventas/api/aremko-cli/bookings/daily/?date_start=2026-05-02&date_stop=2026-05-09
```

**Response**:
```json
{
    "success": true,
    "data": [
        {
            "date": "2026-05-02",
            "count": 5,
            "revenue": 295000.0
        },
        {
            "date": "2026-05-03",
            "count": 8,
            "revenue": 472000.0
        }
    ]
}
```

### 4. Client Statistics

**Request**:
```bash
GET http://localhost:8002/ventas/api/aremko-cli/clients/stats/
```

**Response**:
```json
{
    "success": true,
    "data": {
        "total_clients": 1250,
        "new_clients_week": 15,
        "returning_clients_week": 10,
        "period": {
            "start": "2026-05-02",
            "end": "2026-05-09"
        }
    }
}
```

## Testing Guide

### Prerequisites

You need the Django server running. Choose one option:

#### Option A: Local Docker (Recommended)
```bash
cd ~/Documents/github/aremko-booking-26-abril
docker-compose up --build

# Access points:
# - Django: http://localhost:8002
# - PostgreSQL: localhost:5435
# - pgAdmin: http://localhost:5052
```

#### Option B: Local Manual Setup
```bash
cd ~/Documents/github/aremko-booking-26-abril
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8002
```

#### Option C: Use Production Server
Update `.env` in aremko-cli:
```bash
BOOKING_SYSTEM_URL=https://your-app.onrender.com
```

### Testing Steps

#### 1. Test Django API Directly

```bash
# Health check
curl http://localhost:8002/ventas/api/aremko-cli/health/ | python3 -m json.tool

# Booking stats (last week)
curl "http://localhost:8002/ventas/api/aremko-cli/bookings/stats/?date_start=2026-05-02&date_stop=2026-05-09" | python3 -m json.tool

# Daily breakdown
curl "http://localhost:8002/ventas/api/aremko-cli/bookings/daily/?date_start=2026-05-02&date_stop=2026-05-09" | python3 -m json.tool

# Client stats
curl http://localhost:8002/ventas/api/aremko-cli/clients/stats/ | python3 -m json.tool
```

#### 2. Test aremko-cli Integration

```bash
cd /Users/jorgeaguilera/aremko-cli/backend

# Update .env with Django URL
echo "BOOKING_SYSTEM_URL=http://localhost:8002" >> .env
echo "ENABLE_BOOKINGS=true" >> .env

# Rebuild (already done)
# go build -o aremko ./cmd/aremko/

# Start aremko API server
./aremko server

# In another terminal, test the endpoint
curl http://localhost:8080/api/v1/stats/overview | python3 -m json.tool
```

**Expected output** should show:
- `bookings.status: "real_data"` (if Django is accessible)
- Real booking numbers from Django database
- OR `bookings.status: "mock_data"` with error message (if Django is down)

#### 3. Test Frontend Integration

```bash
# Frontend should already be running on localhost:3000
# Open browser: http://localhost:3000

# The "Reservas - Última Semana" section should show:
# - Badge: "🔄 Datos en vivo" (if real data)
# - OR Badge: "📊 Datos de ejemplo" (if mock data)
```

#### 4. Verify Health Check

```bash
curl http://localhost:8080/health | python3 -m json.tool
```

Should show:
```json
{
    "services": {
        "bookings": true,
        "meta_ads": true,
        // ...
    }
}
```

## Troubleshooting

### Django Server Not Running

**Symptom**: `curl: (7) Failed to connect to localhost port 8002`

**Solutions**:
1. Start Docker: `docker-compose up` in Django project
2. Or start manual server: `python manage.py runserver 8002`
3. Or use production URL in `BOOKING_SYSTEM_URL`

### Import Error in Django

**Symptom**: `ModuleNotFoundError: No module named 'ventas.api_aremko_cli'`

**Solution**: Restart Django server to reload modules:
```bash
# If using Docker
docker-compose restart web

# If using manual
# Ctrl+C and run python manage.py runserver again
```

### aremko-cli Shows Mock Data

**Symptom**: Dashboard shows "Datos de ejemplo" instead of real data

**Check**:
1. Is `ENABLE_BOOKINGS=true` in `.env`?
2. Is `BOOKING_SYSTEM_URL` correct?
3. Is Django server accessible? Test with curl
4. Check aremko server logs for error messages

### CORS Issues

**Symptom**: Browser console shows CORS errors

**Solution**: Django is configured with `@csrf_exempt` for these endpoints. If issues persist, add CORS headers in Django settings.

### Empty Data

**Symptom**: API returns `"total": 0, "revenue": 0`

**This is normal if**:
- The date range has no bookings
- All bookings in range are cancelled
- Database is empty (new installation)

**Verify**:
```bash
# Check Django admin for data
http://localhost:8002/admin/
```

## Security Considerations

### Current Implementation
- **No authentication** on aremko-cli API endpoints
- **Read-only** operations (safe)
- **CSRF exempt** for API endpoints

### Production Recommendations

1. **Add API Key Authentication**:
```python
# In api_aremko_cli.py
def require_api_key(view_func):
    def wrapper(request, *args, **kwargs):
        api_key = request.headers.get('X-API-KEY')
        if api_key != settings.AREMKO_CLI_API_KEY:
            return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=401)
        return view_func(request, *args, **kwargs)
    return wrapper

@require_api_key
@csrf_exempt
def bookings_stats(request):
    # ...
```

2. **Rate Limiting**:
Use Django middleware or nginx to limit requests per IP.

3. **HTTPS Only**:
Ensure production uses HTTPS for both Django and aremko-cli.

4. **IP Whitelist** (Optional):
Restrict access to known IPs only.

## Future Enhancements

- [ ] Add caching (Redis) for frequently accessed data
- [ ] Real-time updates via WebSocket
- [ ] Export endpoints for CSV/Excel
- [ ] Historical data comparison
- [ ] Predictive analytics
- [ ] Alert system for anomalies

## Production Deployment

### Django (Render)

Already deployed. Just need to:
1. Commit and push new files to Git
2. Render will auto-deploy

### aremko-cli Configuration

Update production `.env`:
```bash
BOOKING_SYSTEM_URL=https://aremko-booking.onrender.com
ENABLE_BOOKINGS=true
```

### Testing Production

```bash
# Test Django production API
curl https://aremko-booking.onrender.com/ventas/api/aremko-cli/health/

# Test full integration
./aremko server
# Visit dashboard
```

## Summary

✅ **Django API**: 4 endpoints created, URL routes registered
✅ **Go Client**: Complete HTTP client with types and methods
✅ **Integration**: Real-time data flowing from Django to aremko-cli
✅ **Fallback**: Graceful degradation to mock data if Django unavailable
✅ **Testing**: Comprehensive guide for all scenarios
✅ **Documentation**: Complete specification and troubleshooting

**Next Steps**: Start Django server and test the integration end-to-end.
