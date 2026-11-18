-- Subscription service: consumer_subscriptions

CREATE TABLE IF NOT EXISTS subscriptions.consumer_subscriptions (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consumer_id          UUID NOT NULL,          -- references auth.users (cross-service)
    plan_id              UUID NOT NULL REFERENCES subscriptions.plans(id),
    api_id               UUID NOT NULL,          -- denormalised from plan for query perf
    status               VARCHAR(20) NOT NULL DEFAULT 'active',
    billing_cycle        VARCHAR(20) NOT NULL DEFAULT 'monthly',
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end   TIMESTAMPTZ NOT NULL,
    cancelled_at         TIMESTAMPTZ,
    cancel_reason        TEXT,
    auto_renew           BOOLEAN NOT NULL DEFAULT true,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at           TIMESTAMPTZ,

    CONSTRAINT chk_subs_status  CHECK (status IN ('active', 'paused', 'cancelled', 'expired', 'suspended')),
    CONSTRAINT chk_subs_billing CHECK (billing_cycle IN ('monthly', 'yearly'))
);

-- Only one active subscription per consumer-plan pair
CREATE UNIQUE INDEX IF NOT EXISTS uq_subs_consumer_plan_active
    ON subscriptions.consumer_subscriptions (consumer_id, plan_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_subs_consumer  ON subscriptions.consumer_subscriptions (consumer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subs_plan      ON subscriptions.consumer_subscriptions (plan_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subs_api       ON subscriptions.consumer_subscriptions (api_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subs_status    ON subscriptions.consumer_subscriptions (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subs_consumer_api ON subscriptions.consumer_subscriptions (consumer_id, api_id) WHERE deleted_at IS NULL;
