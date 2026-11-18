-- Subscription service: usage_quotas

CREATE TABLE IF NOT EXISTS subscriptions.usage_quotas (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id     UUID NOT NULL REFERENCES subscriptions.consumer_subscriptions(id) ON DELETE CASCADE,
    period_start        TIMESTAMPTZ NOT NULL,
    period_end          TIMESTAMPTZ NOT NULL,
    request_count       INTEGER NOT NULL DEFAULT 0,
    daily_request_count INTEGER NOT NULL DEFAULT 0,
    daily_reset_at      TIMESTAMPTZ,
    last_request_at     TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_quotas_sub_period UNIQUE (subscription_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_quotas_sub ON subscriptions.usage_quotas (subscription_id);
