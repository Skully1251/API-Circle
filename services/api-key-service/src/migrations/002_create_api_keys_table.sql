-- API Key service: api_keys table

CREATE TABLE IF NOT EXISTS api_keys.api_keys (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consumer_id     UUID NOT NULL,          -- references auth.users (cross-service)
    subscription_id UUID NOT NULL,          -- references subscriptions.consumer_subscriptions (cross-service)
    api_id          UUID NOT NULL,          -- references catalog.apis (cross-service)
    key_prefix      VARCHAR(12) NOT NULL,   -- first chars for identification, e.g. 'ac_a1b2c3d4'
    key_hash        VARCHAR(255) UNIQUE NOT NULL,  -- SHA-256 of the full API key
    name            VARCHAR(100),
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    last_used_at    TIMESTAMPTZ,
    last_used_ip    VARCHAR(45),
    expires_at      TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    revoked_reason  VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT chk_api_keys_status CHECK (status IN ('active', 'revoked', 'expired', 'suspended'))
);

CREATE INDEX IF NOT EXISTS idx_api_keys_consumer      ON api_keys.api_keys (consumer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_subscription   ON api_keys.api_keys (subscription_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_api            ON api_keys.api_keys (api_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix         ON api_keys.api_keys (key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_status         ON api_keys.api_keys (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_consumer_api   ON api_keys.api_keys (consumer_id, api_id) WHERE deleted_at IS NULL;
