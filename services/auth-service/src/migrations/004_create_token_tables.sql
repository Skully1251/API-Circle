-- Auth service: refresh_tokens, email_verifications, password_resets

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash     VARCHAR(255) UNIQUE NOT NULL,
    family_id      UUID NOT NULL,
    expires_at     TIMESTAMPTZ NOT NULL,
    revoked_at     TIMESTAMPTZ,
    revoked_reason VARCHAR(100),
    user_agent     VARCHAR(500),
    ip_address     VARCHAR(45),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active
    ON auth.refresh_tokens (user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family
    ON auth.refresh_tokens (family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires
    ON auth.refresh_tokens (expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS auth.email_verifications (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) UNIQUE NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_user
    ON auth.email_verifications (user_id);

CREATE TABLE IF NOT EXISTS auth.password_resets (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) UNIQUE NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user
    ON auth.password_resets (user_id);
