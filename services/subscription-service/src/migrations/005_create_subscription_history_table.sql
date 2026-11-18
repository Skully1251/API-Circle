-- Subscription service: subscription_history

CREATE TABLE IF NOT EXISTS subscriptions.subscription_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions.consumer_subscriptions(id) ON DELETE CASCADE,
    event_type      VARCHAR(50) NOT NULL,
    from_plan_id    UUID,
    to_plan_id      UUID,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_history_event CHECK (event_type IN (
        'created', 'renewed', 'upgraded', 'downgraded',
        'paused', 'resumed', 'cancelled', 'expired'
    ))
);

CREATE INDEX IF NOT EXISTS idx_sub_history_sub   ON subscriptions.subscription_history (subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_history_event ON subscriptions.subscription_history (event_type);
