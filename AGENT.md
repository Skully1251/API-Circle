# API Circle Agent Guidelines

## Project Overview

API Circle is a centralized API marketplace, gateway, and management platform. It mediates between API consumers and third-party API providers, handling authentication, authorization, subscriptions, API keys, quotas, rate limiting, request forwarding, usage metering, analytics, billing, and notifications.

## Architecture

- Use a microservices architecture with independently deployable services.
- Keep service ownership clear:
  - `api-gateway`: public entry point and routing.
  - `auth-service`: authentication, identity, and authorization.
  - `user-service`: user profiles and account management.
  - `admin-service`: platform administration and moderation.
  - `api-catalog-service`: API registration, documentation, discovery, publishing, and versions.
  - `subscription-service`: plans, subscriptions, quotas, and access.
  - `api-key-service`: API key lifecycle and provider request proxying.
  - `analytics-service`: usage, request, and performance analytics.
  - `notification-service`: email and system notifications.
- NGINX is the external reverse proxy and basic security/rate-limiting layer; business routing and gateway validation belong in `api-gateway`.
- PostgreSQL is the primary relational store. Redis is for low-latency state such as caching and rate limiting. Kafka and RabbitMQ are available for asynchronous/event-driven workflows where appropriate.
- Prefer REST for synchronous service-to-service calls. Use events or queues for durable asynchronous work and avoid introducing synchronous coupling unnecessarily.
- Preserve service isolation: do not access another service's tables directly. Communicate through that service's API or an explicitly defined event contract.

## Implementation Conventions

- Backend code is JavaScript running on Node.js. Follow the existing service layout and use each service's `server.js` entry point unless the service is intentionally reorganized.
- Keep configuration in environment variables. Never commit credentials, provider secrets, API keys, tokens, or production connection strings.
- Validate and authorize requests at the gateway and again at the owning service where the operation is sensitive.
- Treat provider URLs, authentication requirements, request headers, payloads, and responses as untrusted input. Prevent SSRF, credential leakage, unsafe redirects, and uncontrolled response sizes when implementing proxying.
- API keys must be stored and handled securely, shown only when generated, revocable, scoped to subscriptions, and never written in plaintext to logs.
- Apply subscription, quota, and rate-limit checks before forwarding consumer requests. Record usage and failures without exposing secret values or sensitive payloads.
- Use explicit error responses and structured logging. Do not silently swallow errors or return success-shaped fallbacks.
- Keep API contracts, event schemas, service configuration, and documentation synchronized when changing behavior.

## Local Development

- The local environment is defined in `docker-compose.yaml`.
- Start the stack with `docker compose up --build`; the public entry point is NGINX on port `80`.
- Service ports and dependencies are defined in `docker-compose.yaml`; use service names for container-to-container communication.
- Each service currently uses `npm start` (`node server.js`). Run commands from the individual service directory.
- Existing package manifests contain placeholder test scripts in several services. Add focused tests with new behavior and run the relevant service tests before broader validation.

## Change Expectations

- Make small, focused changes within the owning service and update related contracts or documentation.
- Prefer existing dependencies and patterns before adding a new library or infrastructure component.
- Consider idempotency, retries, timeouts, circuit breaking, provider failures, and graceful degradation for all external or inter-service calls.
- Protect backward compatibility for public gateway endpoints and version APIs deliberately when breaking changes are required.
- Verify security, authorization, rate limiting, observability, and failure behavior—not only the happy path.