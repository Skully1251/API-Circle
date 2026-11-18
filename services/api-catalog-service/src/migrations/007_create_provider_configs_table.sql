-- API Catalog service: provider_configs (per-API provider authentication)

CREATE TABLE IF NOT EXISTS catalog.provider_configs (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_id               UUID UNIQUE NOT NULL REFERENCES catalog.apis(id) ON DELETE CASCADE,
    auth_type            VARCHAR(50) NOT NULL,
    auth_config          JSONB NOT NULL DEFAULT '{}',
    rate_limit_per_second INTEGER,
    timeout_ms           INTEGER NOT NULL DEFAULT 30000,
    retry_count          INTEGER NOT NULL DEFAULT 0,
    custom_headers       JSONB NOT NULL DEFAULT '{}',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_provider_auth_type CHECK (auth_type IN ('api_key', 'oauth2', 'basic', 'bearer', 'none'))
);
