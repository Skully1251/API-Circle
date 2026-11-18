-- User service: user_profiles, provider_profiles, consumer_profiles

CREATE TABLE IF NOT EXISTS users.user_profiles (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID UNIQUE NOT NULL,  -- references auth.users (cross-service)
    first_name   VARCHAR(100),
    last_name    VARCHAR(100),
    display_name VARCHAR(150),
    avatar_url   VARCHAR(500),
    bio          TEXT,
    phone        VARCHAR(20),
    timezone     VARCHAR(50) NOT NULL DEFAULT 'UTC',
    locale       VARCHAR(10) NOT NULL DEFAULT 'en',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id
    ON users.user_profiles (user_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS users.provider_profiles (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID UNIQUE NOT NULL,  -- references auth.users (cross-service)
    company_name     VARCHAR(200),
    company_website  VARCHAR(500),
    company_logo_url VARCHAR(500),
    description      TEXT,
    support_email    VARCHAR(255),
    support_url      VARCHAR(500),
    is_verified      BOOLEAN NOT NULL DEFAULT false,
    verified_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_provider_profiles_user_id
    ON users.provider_profiles (user_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS users.consumer_profiles (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID UNIQUE NOT NULL,  -- references auth.users (cross-service)
    company_name VARCHAR(200),
    use_case     TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_consumer_profiles_user_id
    ON users.consumer_profiles (user_id) WHERE deleted_at IS NULL;
