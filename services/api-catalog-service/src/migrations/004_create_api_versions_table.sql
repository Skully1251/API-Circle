-- API Catalog service: api_versions

CREATE TABLE IF NOT EXISTS catalog.api_versions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_id        UUID NOT NULL REFERENCES catalog.apis(id) ON DELETE CASCADE,
    version       VARCHAR(50) NOT NULL,
    base_url      VARCHAR(500) NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'active',
    is_default    BOOLEAN NOT NULL DEFAULT false,
    changelog     TEXT,
    deprecated_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_api_versions_api_version UNIQUE (api_id, version),
    CONSTRAINT chk_api_versions_status     CHECK (status IN ('active', 'deprecated', 'retired'))
);

CREATE INDEX IF NOT EXISTS idx_api_versions_api ON catalog.api_versions (api_id);
