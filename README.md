# Webhook Receiver Service

A production-ready webhook receiver service built with NestJS, featuring authentication, signature verification, rate limiting, and comprehensive testing.

## Features

- **Authentication**: API key-based authentication for all protected endpoints
- **Signature Verification**: HMAC-SHA256 webhook signature validation
- **Rate Limiting**: Configurable request throttling (100 req/min default)
- **Idempotency**: Duplicate request handling via `X-Idempotency-Key` header
- **Persistence**: SQLite (default) with PostgreSQL-ready abstraction
- **Pagination**: Efficient listing with filtering support
- **Health Checks**: Liveness and readiness endpoints
- **Request Tracing**: Unique request IDs for debugging
- **API Documentation**: Swagger/OpenAPI at `/api/docs`

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd webhook-receiver-service

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Build the project
npm run build

# Start the server
npm run start:prod
```

The service will be available at `http://localhost:3000`

### Using Docker

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or build manually
docker build -t webhook-service .
docker run -p 3000:3000 webhook-service
```

## API Documentation

Interactive API documentation is available at: `http://localhost:3000/api/docs`

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/webhooks` | API Key + Signature | Receive a webhook |
| GET | `/api/v1/webhooks` | API Key | List webhooks (paginated) |
| GET | `/api/v1/webhooks/:id` | API Key | Get webhook by ID |
| GET | `/api/health` | None | Liveness check |
| GET | `/api/health/ready` | None | Readiness check |

### Authentication

All protected endpoints require the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-api-key" http://localhost:3000/api/v1/webhooks
```

### Webhook Signature

POST requests require HMAC-SHA256 signature in `X-Webhook-Signature` header:

```bash
# Generate signature
PAYLOAD='{"source":"stripe","event":"payment.completed","payload":{"orderId":"123"}}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "your-webhook-secret" | awk '{print $2}')

# Send webhook
curl -X POST http://localhost:3000/api/v1/webhooks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

### Idempotency

Prevent duplicate processing with `X-Idempotency-Key`:

```bash
curl -X POST http://localhost:3000/api/v1/webhooks \
  -H "X-API-Key: your-api-key" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Idempotency-Key: unique-request-id-123" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
```

### Pagination

```bash
# Get page 2 with 10 items per page
curl "http://localhost:3000/api/v1/webhooks?page=2&limit=10" \
  -H "X-API-Key: your-api-key"

# Filter by source
curl "http://localhost:3000/api/v1/webhooks?source=stripe" \
  -H "X-API-Key: your-api-key"
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `DB_TYPE` | Database type (`sqlite` or `postgres`) | `sqlite` |
| `DB_DATABASE` | Database name/path | `webhooks.db` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USERNAME` | PostgreSQL username | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | - |
| `API_KEY` | API key for authentication | - |
| `WEBHOOK_SECRET` | Secret for HMAC signatures | - |
| `THROTTLE_TTL` | Rate limit window (ms) | `60000` |
| `THROTTLE_LIMIT` | Requests per window | `100` |
| `MAX_PAYLOAD_SIZE` | Max request body size | `1mb` |

### PostgreSQL Configuration

To use PostgreSQL instead of SQLite:

```bash
# .env
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your-password
DB_DATABASE=webhooks
```

## Development

### Running in Development Mode

```bash
# Watch mode with hot reload
npm run start:dev

# Debug mode
npm run start:debug
```

### Running Tests

```bash
# Unit tests
npm test

# Unit tests with watch
npm run test:watch

# Test coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

### Building

```bash
npm run build
```

## Project Structure

```
src/
├── main.ts                    # Application bootstrap
├── app.module.ts              # Root module
├── config/
│   ├── configuration.ts       # Environment config
│   └── database.config.ts     # TypeORM config
├── common/
│   ├── filters/               # Exception filters
│   ├── guards/                # (empty - guards in auth)
│   ├── interceptors/          # Logging, idempotency
│   └── middleware/            # Request ID
├── auth/
│   ├── guards/                # API key, signature guards
│   ├── services/              # Signature verification
│   └── decorators/            # @Public(), @SkipSignature()
├── webhooks/
│   ├── dto/                   # Request/response DTOs
│   ├── entities/              # TypeORM entities
│   ├── webhooks.controller.ts
│   ├── webhooks.service.ts
│   └── webhooks.module.ts
└── health/
    ├── health.controller.ts
    └── health.module.ts
```

## Architecture

### Request Flow

```
Request
   │
   ▼
RequestIdMiddleware (adds X-Request-ID)
   │
   ▼
LoggingInterceptor (logs request/response)
   │
   ▼
IdempotencyInterceptor (handles duplicate requests)
   │
   ▼
ThrottlerGuard (rate limiting)
   │
   ▼
ApiKeyGuard (authentication)
   │
   ▼
SignatureGuard (webhook verification - POST only)
   │
   ▼
ValidationPipe (DTO validation)
   │
   ▼
Controller → Service → Repository → Database
```

### Design Patterns

- **Repository Pattern**: Data access abstraction via TypeORM
- **DTO Pattern**: Input validation and response shaping
- **Guard Pattern**: Authentication and authorization
- **Interceptor Pattern**: Cross-cutting concerns
- **Filter Pattern**: Exception handling

## Security

- **API Key Authentication**: Required for all protected endpoints
- **HMAC-SHA256 Signatures**: Webhook payload verification
- **Timing-Safe Comparison**: Prevents timing attacks
- **Rate Limiting**: Protects against DoS attacks
- **Input Validation**: Strict DTO validation
- **Payload Size Limits**: Prevents memory exhaustion

## Changes from Original

See [ANALYSIS.md](./ANALYSIS.md) for detailed documentation of:
- Issues identified in the original codebase
- Severity categorization and prioritization
- Implemented fixes with before/after examples
- Architecture decisions and trade-offs

## License

ISC
