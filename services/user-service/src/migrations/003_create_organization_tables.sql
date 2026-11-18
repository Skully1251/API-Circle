-- User service: organizations and organization_members

CREATE TABLE IF NOT EXISTS users.organizations (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          VARCHAR(200) NOT NULL,
    slug          VARCHAR(200) UNIQUE NOT NULL,
    description   TEXT,
    logo_url      VARCHAR(500),
    website       VARCHAR(500),
    owner_user_id UUID NOT NULL,  -- references auth.users (cross-service)
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner
    ON users.organizations (owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_slug
    ON users.organizations (slug) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS users.organization_members (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES users.organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL,  -- references auth.users (cross-service)
    role            VARCHAR(50) NOT NULL DEFAULT 'member',
    invited_by      UUID,           -- references auth.users (cross-service)
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT uq_org_members_org_user UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user_id
    ON users.organization_members (user_id) WHERE deleted_at IS NULL;
