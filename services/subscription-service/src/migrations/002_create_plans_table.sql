-- Subscription service: plans

CREATE TABLE IF NOT EXISTS subscriptions.plans (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_id                UUID NOT NULL,          -- references catalog.apis (cross-service)
    name                  VARCHAR(100) NOT NULL,
    slug                  VARCHAR(100) NOT NULL,
    description           TEXT,
    price_monthly         DECIMAL(10,2) NOT NULL DEFAULT 0,
    price_yearly          DECIMAL(10,2),
    currency              VARCHAR(3) NOT NULL DEFAULT 'USD',
    request_limit_daily   INTEGER,                -- NULL = unlimited
    request_limit_monthly INTEGER,
    rate_limit_per_second  INTEGER,
    rate_limit_per_minute  INTEGER,
    is_active             BOOLEAN NOT NULL DEFAULT true,
    is_featured           BOOLEAN NOT NULL DEFAULT false,
    sort_order            INTEGER NOT NULL DEFAULT 0,
    features              JSONB NOT NULL DEFAULT '[]',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at            TIMESTAMPTZ,

    CONSTRAINT uq_plans_api_slug UNIQUE (api_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_plans_api      ON subscriptions.plans (api_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_plans_active   ON subscriptions.plans (is_active) WHERE deleted_at IS NULL;
