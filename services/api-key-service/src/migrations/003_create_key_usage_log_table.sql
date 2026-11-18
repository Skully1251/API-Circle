-- API Key service: key_usage_log (audit trail)
-- For high-volume production, consider partitioning this table by month:
--   CREATE TABLE api_keys.key_usage_log (...) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS api_keys.key_usage_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_key_id      UUID NOT NULL REFERENCES api_keys.api_keys(id) ON DELETE CASCADE,
    endpoint        VARCHAR(500),
    method          VARCHAR(10),
    status_code     INTEGER,
    response_time_ms INTEGER,
    ip_address      VARCHAR(45),
    user_agent      VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_key_usage_log_key     ON api_keys.key_usage_log (api_key_id);
CREATE INDEX IF NOT EXISTS idx_key_usage_log_created ON api_keys.key_usage_log (created_at);
