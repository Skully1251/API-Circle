# API Circle — System Architecture & Agent Guidelines

## 1. Project Overview

API Circle is a centralized API marketplace, gateway, and management platform built on the **PERN stack (PostgreSQL, Express, React, Node.js)**. It mediates between third-party **API Providers** and global **API Consumers**, handling discovery, self-service credential generation, subscription lifecycle, distributed rate limiting, quota enforcement, request forwarding/proxying, usage metering, analytics, and notifications.

---

## 2. High-Level Architecture & Layering

The system is organized into three architectural planes:

1. **Data Plane (Runtime):** 
   - **Tier 1 (Edge NGINX):** Public reverse proxy (Port 80/443). Handles TLS termination, coarse IP flood protection (`limit_req_zone`), and HTTP load balancing.
   - **Tier 2 (Application API Gateway):** Node.js / Express gateway (`services/api-gateway`). Performs API key SHA-256 validation, subscription verification, distributed Token Bucket rate limiting via Redis Lua, quota validation, provider credential injection, reverse proxying, and asynchronous Kafka telemetry emission.
   - Target latency overhead: **< 5ms** at p99.99 with **zero synchronous PostgreSQL queries** on the hot path (all metadata served from Redis).

2. **Control Plane (Management & Lifecycle):**
   - Node.js / Express microservices backing the React UI portal for catalog publishing, user/org administration, subscription management, and dual-hashed API credential issuance.

3. **Analytics & Async Messaging Plane:**
   - **Apache Kafka:** Event streaming backbone for high-throughput usage metering (`api.usage.events`).
   - **RabbitMQ:** Direct inter-service RPC validation (`api-key.validate`) and durable task queues (`notification.dispatch`).

```
[ Client / SDK ]
       │ HTTPS
       ▼
[ NGINX Edge Proxy (Port 80) ]
       │ Reverse Proxy
       ▼
[ api-gateway (Port 3000) ] ◄───► [ Redis 7 (Hot Routes, Keys, Token Bucket Lua) ]
       │                                │
       ├─► [ Upstream Provider APIs ]   └─► Async Kafka Event: api.usage.events
       │
[ Control Plane Microservices (Ports 3001-3008) ]
       │
       ├─► [ PostgreSQL 16 (Logical Schemas per Service) ]
       ├─► [ Redis 7 (Cache & Blacklist) ]
       ├─► [ RabbitMQ (RPC & Tasks) ]
       └─► [ Kafka (Usage Streams) ]
```

---

## 3. Microservices Topology & Ownership

| Service Name | Port | Primary Responsibility | Storage / State | Messaging Role |
|---|---|---|---|---|
| `api-gateway` | 3000 | Data Plane proxy, auth verification, Redis rate limit Lua, quota check, provider secret injection | Redis 7 (Cache only) | Emits to Kafka `api.usage.events` |
| `auth-service` | 3001 | Identity, bcrypt passwords, JWT issuance, roles & permissions, token rotation | PostgreSQL (`auth` schema), Redis | Publishes auth events |
| `user-service` | 3002 | User profiles, provider/consumer profiles, organizations, team memberships | PostgreSQL (`users` schema) | RabbitMQ RPC client (`api-key.validate`) |
| `admin-service` | 3003 | Platform administration, moderation, security audit | PostgreSQL (`admin` / shared) | Audits administrative events |
| `api-catalog-service` | 3004 | API registration, versions, endpoints, documentation, encrypted provider configs | PostgreSQL (`catalog` schema), Redis | Updates route cache in Redis |
| `analytics-service` | 3005 | Telemetry ingestion, metrics aggregation (p50/p95/p99 latency, error rates, usage) | PostgreSQL (`analytics`), Redis | Consumes Kafka `api.usage.events` |
| `notification-service` | 3006 | Email templates, delivery tracking, quota alerts (80% / 100%), retry queue | PostgreSQL (`notifications` schema) | RabbitMQ worker (`notification.dispatch`) |
| `subscription-service` | 3007 | Plans (Free/Basic/Pro), pricing, consumer subscriptions, quota tracking | PostgreSQL (`subscriptions` schema) | Syncs subscriptions to Redis |
| `api-key-service` | 3008 | Dual-token key generation, SHA-256 hash storage, rotation, revocation | PostgreSQL (`api_keys` schema), Redis | RabbitMQ RPC server (`api-key.validate`) |

---

## 4. Database Architecture (Database-per-Service)

A single PostgreSQL 16 instance hosts logically separated schemas. **Microservices never share database connections or execute cross-schema JOINs.**

### Schema Ownership & Tables

1. **`auth` Schema (`auth-service`)**
   - `auth.users`: Core user accounts (email, bcrypt password_hash, is_email_verified, locked_until, soft-delete).
   - `auth.roles`: System and custom roles (`admin`, `provider`, `consumer`).
   - `auth.permissions`: Resource-action permissions (e.g. `api:create`, `subscription:read`).
   - `auth.role_permissions`: Role-permission mappings.
   - `auth.user_roles`: User-role assignments.
   - `auth.refresh_tokens`: SHA-256 hashed refresh tokens with `family_id` for token rotation / reuse detection.
   - `auth.email_verifications`: Email verification tokens.
   - `auth.password_resets`: Password reset tokens.

2. **`users` Schema (`user-service`)**
   - `users.organizations`: Organization entities (slug, owner_user_id, is_active, soft-delete).
   - `users.organization_members`: Org membership with roles (`owner`, `admin`, `member`).
   - `users.user_profiles`: Extended profiles (display_name, avatar, timezone, phone).
   - `users.provider_profiles`: API provider business profiles (company_name, support_email, is_verified).
   - `users.consumer_profiles`: API consumer profiles (use_case, company_name).
   - `users.account_settings`: Notification toggles, themes, 2FA settings.

3. **`catalog` Schema (`api-catalog-service`)**
   - `catalog.categories`: Hierarchical category tree with self-referencing `parent_id`.
   - `catalog.apis`: Registered APIs (provider_id, slug, visibility: `public`/`private`, status: `draft`/`published`).
   - `catalog.api_tags`: Many-to-many API tagging.
   - `catalog.api_versions`: Semantic versions (`v1`, `v2.0`) with `base_url` and `is_default`.
   - `catalog.api_endpoints`: Endpoints (path, method, JSONB request/response schemas).
   - `catalog.api_documentation`: Documentation resources (`openapi`, `markdown`, `swagger`).
   - `catalog.provider_configs`: Per-API provider authentication configs (auth_type: `api_key`/`bearer`/`basic`, AES-256-GCM encrypted `auth_config`, timeout_ms, retry_count).

4. **`subscriptions` Schema (`subscription-service`)**
   - `subscriptions.plans`: Tiered pricing plans (slug, price_monthly, rate_limit_per_second, request_limit_daily, request_limit_monthly, JSONB features).
   - `subscriptions.consumer_subscriptions`: Active subscriptions binding consumer to plan and API.
   - `subscriptions.usage_quotas`: Period usage tracking with atomic request counters and daily reset logic.
   - `subscriptions.subscription_history`: Audit trail for upgrades, downgrades, cancellations.

5. **`api_keys` Schema (`api-key-service`)**
   - `api_keys.api_keys`: Dual-token credentials (`key_prefix` for display, `key_hash` SHA-256 for validation, status: `active`/`revoked`/`expired`).
   - `api_keys.key_usage_log`: Usage audit trail (endpoint, method, status_code, response_time_ms, ip_address).

6. **`notifications` Schema (`notification-service`)**
   - `notifications.notification_templates`: Reusable templates with `{{variable}}` interpolation.
   - `notifications.notifications`: Notification inbox history and read states.
   - `notifications.email_deliveries`: Delivery attempts, provider message IDs, retry status.
   - `notifications.notification_preferences`: Per-user per-type alert preferences.

### Relational Guidelines for Agents
- Always use `UUID PRIMARY KEY DEFAULT uuid_generate_v4()`.
- Cross-service references MUST be stored as bare `UUID` columns with **NO foreign key constraints**.
- Use partial indexes on active records (e.g. `WHERE deleted_at IS NULL`).
- Never run cross-schema queries. Fetch related data via REST or asynchronous events.
- All migrations live in `<service>/src/migrations/` and must be idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).

---

## 5. Redis Key Schema & Caching Guidelines

Redis 7 is used for low-latency caching, rate limiting, and temporary state. All keys are strictly namespaced:

| Key Pattern | Type | TTL | Purpose |
|---|---|---|---|
| `apikey:hash:{sha256}` | String (JSON) | 300s (5 min) | Key metadata: `{ id, consumerId, subscriptionId, apiId, plan, status }` |
| `catalog:route:{slug}:{version}` | String (JSON) | 600s (10 min) | Upstream provider route: `{ targetBaseUrl, authType, secret }` |
| `ratelimit:tb:{subscriptionId}` | Hash | 60s | Token Bucket state: `tokens` (float), `last_updated` (epoch sec) |
| `sub:quota:{subscriptionId}` | String (Int) | 35 days | Atomic monthly call counter for quota enforcement |
| `auth:blacklist:{tokenHash}` | String | JWT expiry | Blacklisted refresh/access tokens |
| `user:profile:{userId}` | String (JSON) | 600s (10 min) | Cached user profile |
| `notif:unread:{userId}` | String (Int) | 120s (2 min) | Cached unread notification count |

### Distributed Rate Limiter (Token Bucket Lua)
The gateway evaluates rate limits using an atomic Lua script executed via `redis.evalsha()`. It computes token replenishment, deducts the requested token, and atomically updates the monthly quota counter in a single round-trip without locking.

---

## 6. Messaging Guidelines (Kafka vs. RabbitMQ)

API Circle uses a dual messaging pattern:

1. **Apache Kafka (Streaming Telemetry):**
   - Topic: `api.usage.events` (16 partitions, partition key: `consumerId`).
   - The Gateway sends fire-and-forget JSON payloads after each request.
   - Consumers in `analytics-service` ingest batches for reporting and quota rollup.

2. **RabbitMQ (RPC & Tasks):**
   - **RPC Validation Queue (`api-key.validate`):** Used when services need synchronous-like verification without HTTP coupling. The requester creates an ephemeral `replyTo` queue and sets `correlationId`. The `api-key-service` consumes, validates, and replies.
   - **Task Queues (`notification.dispatch`):** Used for background email deliveries with Dead-Letter Exchanges (DLX) for failed attempts.

---

## 7. Security Architecture

1. **Dual-Token API Key Scheme:**
   - Format: `ac_live_<12-char-prefix>_<secret>` (e.g., `ac_live_7b9a1c2d_3f8e9a2b0c1d...`).
   - The plaintext key is returned to the user **exactly once** upon creation.
   - The database stores only the visible `key_prefix` (for UI and indexing) and the **SHA-256 hash** (`key_hash`). Plaintext keys are NEVER persisted.
   - Revocation: Updates status in PostgreSQL and immediately deletes/invalidates `apikey:hash:{sha256}` in Redis.

2. **Provider Credential Protection:**
   - Third-party provider credentials in `catalog.provider_configs.auth_config` are encrypted at rest using **AES-256-GCM** with 128-bit authentication tags.
   - Encryption master keys are injected via environment variables.

3. **SSRF & Input Defense:**
   - Provider target URLs must be validated against allowed protocols (`https://` required in production) and forbidden local IP ranges (`127.0.0.1`, `169.254.169.254`, `10.0.0.0/8`, etc.).

---

## 8. Request Processing Flow (The 13 Steps)

When an incoming API request reaches API Circle:

1. **Receive Request:** NGINX terminates TLS on port 80/443, checks IP flood limit, forwards to `api-gateway:3000`.
2. **Correlation ID:** Gateway attaches or generates `x-correlation-id` UUIDv4.
3. **Route Resolution:** Extracts target API slug and version from path (e.g., `/weather/v1/forecast`).
4. **Credential Extraction:** Extracts API key from `x-api-circle-key` (or `x-api-key`).
5. **Key Hashing:** Computes SHA-256 hash of the plaintext key.
6. **Cache Lookup:** Fetches key metadata from Redis (`apikey:hash:{sha256}`). If missing, rejects with `401 Unauthorized`.
7. **Subscription Verification:** Ensures key and subscription are `active`.
8. **Rate Limiting:** Executes atomic Token Bucket Lua script against `ratelimit:tb:{subId}`. If exhausted, rejects with `429 Too Many Requests` + `Retry-After`.
9. **Quota Check:** Evaluates monthly quota counter in Redis. If exceeded, rejects with `403 Forbidden`.
10. **Provider Resolution:** Resolves provider backend base URL and decrypted authentication config from Redis (`catalog:route:{slug}:{ver}`).
11. **Provider Proxying:** Forwards request to provider backend with injected provider secret (Bearer / API key).
12. **Client Streaming:** Streams provider response back to client with standard `X-RateLimit-*` headers.
13. **Asynchronous Metering:** Gateway non-blockingly publishes an `ApiInvokedEvent` to Kafka topic `api.usage.events`.

---

## 9. Core REST API Catalog & Endpoint Reference

Each service provides standard RESTful endpoints returning JSON payloads with consistent status codes:

### Auth Service (`auth-service`: Port 3001)
- `POST /api/v1/auth/register` — Register new user account `{ email, password }` &rarr; `201 Created`
- `POST /api/v1/auth/login` — Authenticate with email & password &rarr; `200 OK { token, refreshToken, user }`
- `POST /api/v1/auth/refresh` — Rotate refresh token & issue new JWT &rarr; `200 OK { token, refreshToken }`
- `POST /api/v1/auth/verify-email` — Verify email via token &rarr; `200 OK`
- `POST /api/v1/auth/reset-password` — Request / execute password reset &rarr; `200 OK`

### User Service (`user-service`: Port 3002)
- `GET /users/me` — Return authenticated user context (validates `x-api-key` via RabbitMQ RPC) &rarr; `200 OK`
- `GET /api/v1/users/:id/profile` — Get extended user profile &rarr; `200 OK`
- `PUT /api/v1/users/:id/profile` — Update user profile &rarr; `200 OK`
- `POST /api/v1/organizations` — Create provider/consumer organization &rarr; `201 Created`
- `GET /api/v1/organizations/:id/members` — List organization team members &rarr; `200 OK`
- `POST /api/v1/organizations/:id/members` — Add member to organization &rarr; `201 Created`

### API Catalog Service (`api-catalog-service`: Port 3004)
- `GET /api/v1/apis` — List published APIs with filtering by category, search term, and visibility &rarr; `200 OK`
- `POST /api/v1/apis` — Provider registers new API `{ name, slug, description, category_id }` &rarr; `201 Created`
- `GET /api/v1/apis/:id` — Get full API details with active versions and endpoints &rarr; `200 OK`
- `PUT /api/v1/apis/:id` — Update API metadata, status (`draft`, `published`, `deprecated`) &rarr; `200 OK`
- `POST /api/v1/apis/:id/versions` — Publish new semantic version (`v1`, `v2.0`) &rarr; `201 Created`
- `POST /api/v1/apis/:id/endpoints` — Declare path, method, and request/response schemas &rarr; `201 Created`
- `PUT /api/v1/apis/:id/provider-config` — Configure upstream target URL and encrypted credentials &rarr; `200 OK`
- `GET /api/v1/marketplace/categories` — List hierarchical API categories &rarr; `200 OK`

### Subscription Service (`subscription-service`: Port 3007)
- `GET /api/v1/apis/:apiId/plans` — List available subscription tiers (Free, Basic, Pro) &rarr; `200 OK`
- `POST /api/v1/apis/:apiId/plans` — Provider creates a pricing tier &rarr; `201 Created`
- `POST /api/v1/subscriptions` — Consumer subscribes to an API plan `{ consumerId, planId, apiId }` &rarr; `201 Created`
- `GET /api/v1/subscriptions/consumer/:consumerId` — List all active subscriptions for consumer &rarr; `200 OK`
- `POST /api/v1/subscriptions/:id/cancel` — Cancel active subscription &rarr; `200 OK`
- `GET /api/v1/subscriptions/:id/quota` — Get current period quota consumption &rarr; `200 OK`

### API Key Service (`api-key-service`: Port 3008)
- `POST /api-keys` — Issue new API key `{ consumerId, subscriptionId, apiId, name }` &rarr; `201 Created { apiKey, keyPrefix }`
- `GET /api-keys/consumer/:consumerId` — List keys for a consumer (returns prefix, name, status; no plaintext) &rarr; `200 OK`
- `DELETE /api-keys/:id` — Revoke an API key (immediate Redis cache eviction) &rarr; `200 OK`
- `RabbitMQ Queue: api-key.validate` — RPC consumer: validates incoming `{ apiKey }` and replies `{ valid: true, user }`

### Notification Service (`notification-service`: Port 3006)
- `POST /api/v1/notifications` — Create/queue notification `{ userId, templateId, channel, data }` &rarr; `201 Created`
- `GET /api/v1/notifications/user/:userId` — List user notifications & unread count &rarr; `200 OK`
- `PUT /api/v1/notifications/:id/read` — Mark notification as read &rarr; `200 OK`
- `PUT /api/v1/notifications/preferences` — Update user channel/type preferences &rarr; `200 OK`

### Analytics Service (`analytics-service`: Port 3005)
- `GET /api/v1/analytics/apis/:apiId/usage` — Aggregated metrics: request volume, error rates, p50/p95/p99 latency &rarr; `200 OK`
- `GET /api/v1/analytics/consumers/:consumerId/usage` — Consumer usage breakdown across subscribed APIs &rarr; `200 OK`

---

## 10. Code & Implementation Conventions

- **Language & Runtime:** JavaScript (CommonJS `require()`, `node:22-alpine`).
- **Database Driver:** `pg` (node-postgres) with connection pooling (`pg.Pool`).
- **Redis Client:** `ioredis` with explicit key prefixes (`auth:`, `user:`, `catalog:`, `sub:`, `apikey:`, `notif:`).
- **RabbitMQ Client:** `amqplib`.
- **Kafka Client:** `kafkajs`.
- **Standard Folder Structure per Service:**
  ```
  services/<service-name>/
  ├── server.js              # Service entry point
  ├── package.json
  ├── Dockerfile
  └── src/
      ├── config/            # db.js, redis.js, rabbitmq.js, kafka.js
      ├── controllers/       # HTTP request handlers
      ├── middlewares/       # Express middlewares (auth, validation, errors)
      ├── migrations/        # 001_create_*.sql, migrate.js
      ├── models/            # Entity query helpers (raw SQL with pg.Pool)
      ├── repositories/      # Data access layer
      ├── routes/            # Express router definitions
      ├── seeds/             # Seed data scripts
      ├── services/          # Business logic
      └── utils/             # Helper utilities
  ```
- **Error Handling:** Centralized Express error handler. Never return stack traces to consumers. Return structured JSON: `{ "error": "Descriptive message", "code": "ERROR_CODE" }`.
- **Zero Raw Secrets in Logs:** Never log raw API keys, passwords, provider secrets, or Authorization headers.

---

## 11. Local Development & Docker Stack

- Stack defined in `docker-compose.yaml`:
  - `nginx`: Edge reverse proxy (Port 80)
  - `api-gateway`: Internal port 3000
  - `auth-service`: Internal port 3001
  - `user-service`: Port 3002
  - `admin-service`: Port 3003
  - `api-catalog-service`: Port 3004
  - `analytics-service`: Port 3005
  - `notification-service`: Port 3006
  - `subscription-service`: Port 3007
  - `api-key-service`: Port 3008
  - `postgres`: PostgreSQL 16 (Port 5432, db: `api_circle`, user: `api_circle`)
  - `redis`: Redis 7 (Port 6379)
  - `kafka`: Apache Kafka 3.8 (Port 9092, KRaft mode)
  - `rabbitmq`: RabbitMQ 3 Management (Port 5672, management UI: 15672)
- Start stack: `docker compose up --build`
- Run service migrations: `node src/migrations/migrate.js` from within the service directory.

---

## 12. CI/CD Standards

- **GitHub Actions:** Multi-job matrix testing each microservice against ephemeral PostgreSQL and Redis service containers; multi-arch Docker image builds pushed on merge to `main`.
- **GitLab CI:** Staged pipeline (`test` &rarr; `build` &rarr; `deploy`) leveraging Docker-in-Docker (`dind`).
- Every PR must pass unit tests, lint checks, and migration dry-runs before merging.
