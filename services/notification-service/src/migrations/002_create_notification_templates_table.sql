-- Notification service: notification_templates

CREATE TABLE IF NOT EXISTS notifications.notification_templates (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name             VARCHAR(100) UNIQUE NOT NULL,
    channel          VARCHAR(20) NOT NULL DEFAULT 'email',
    subject_template VARCHAR(500),
    body_template    TEXT NOT NULL,
    html_template    TEXT,
    is_active        BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_template_channel CHECK (channel IN ('email', 'in_app', 'both'))
);

CREATE INDEX IF NOT EXISTS idx_templates_name    ON notifications.notification_templates (name);
CREATE INDEX IF NOT EXISTS idx_templates_channel ON notifications.notification_templates (channel);
