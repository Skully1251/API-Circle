-- Notification service: notifications (history)

CREATE TABLE IF NOT EXISTS notifications.notifications (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL,              -- references auth.users (cross-service)
    template_id UUID REFERENCES notifications.notification_templates(id) ON DELETE SET NULL,
    channel     VARCHAR(20) NOT NULL,
    type        VARCHAR(50) NOT NULL DEFAULT 'info',
    title       VARCHAR(500) NOT NULL,
    body        TEXT NOT NULL,
    data        JSONB NOT NULL DEFAULT '{}',
    is_read     BOOLEAN NOT NULL DEFAULT false,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_notif_channel CHECK (channel IN ('email', 'in_app')),
    CONSTRAINT chk_notif_type    CHECK (type IN ('info', 'warning', 'success', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user       ON notifications.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications.notifications (user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created     ON notifications.notifications (created_at);
