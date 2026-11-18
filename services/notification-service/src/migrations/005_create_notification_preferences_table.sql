-- Notification service: notification_preferences

CREATE TABLE IF NOT EXISTS notifications.notification_preferences (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID NOT NULL,          -- references auth.users (cross-service)
    notification_type VARCHAR(100) NOT NULL,
    email_enabled     BOOLEAN NOT NULL DEFAULT true,
    in_app_enabled    BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_prefs_user_type UNIQUE (user_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON notifications.notification_preferences (user_id);
