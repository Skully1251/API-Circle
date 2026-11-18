-- User service: account_settings

CREATE TABLE IF NOT EXISTS users.account_settings (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID UNIQUE NOT NULL,  -- references auth.users (cross-service)
    email_notifications BOOLEAN NOT NULL DEFAULT true,
    marketing_emails    BOOLEAN NOT NULL DEFAULT false,
    two_factor_enabled  BOOLEAN NOT NULL DEFAULT false,
    theme               VARCHAR(20) NOT NULL DEFAULT 'light',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
