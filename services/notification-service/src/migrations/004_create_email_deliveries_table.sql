-- Notification service: email_deliveries

CREATE TABLE IF NOT EXISTS notifications.email_deliveries (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id     UUID NOT NULL REFERENCES notifications.notifications(id) ON DELETE CASCADE,
    recipient_email     VARCHAR(255) NOT NULL,
    subject             VARCHAR(500) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    provider            VARCHAR(50),
    provider_message_id VARCHAR(255),
    error_message       TEXT,
    attempts            INTEGER NOT NULL DEFAULT 0,
    max_attempts        INTEGER NOT NULL DEFAULT 3,
    next_retry_at       TIMESTAMPTZ,
    sent_at             TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_delivery_status CHECK (status IN ('pending', 'sent', 'delivered', 'bounced', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_email_deliveries_notification ON notifications.email_deliveries (notification_id);
CREATE INDEX IF NOT EXISTS idx_email_deliveries_status       ON notifications.email_deliveries (status);
CREATE INDEX IF NOT EXISTS idx_email_deliveries_retry        ON notifications.email_deliveries (status, next_retry_at)
    WHERE status IN ('pending', 'sent');
