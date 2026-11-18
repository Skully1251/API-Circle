-- API Catalog service: apis and api_tags

CREATE TABLE IF NOT EXISTS catalog.apis (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id          UUID NOT NULL,          -- references auth.users (cross-service)
    name                 VARCHAR(200) NOT NULL,
    slug                 VARCHAR(200) UNIQUE NOT NULL,
    description          TEXT,
    short_description    VARCHAR(500),
    category_id          UUID REFERENCES catalog.categories(id) ON DELETE SET NULL,
    logo_url             VARCHAR(500),
    website_url          VARCHAR(500),
    terms_of_service_url VARCHAR(500),
    visibility           VARCHAR(20) NOT NULL DEFAULT 'private',
    status               VARCHAR(20) NOT NULL DEFAULT 'draft',
    is_featured          BOOLEAN NOT NULL DEFAULT false,
    published_at         TIMESTAMPTZ,
    deprecated_at        TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at           TIMESTAMPTZ,

    CONSTRAINT chk_apis_visibility CHECK (visibility IN ('private', 'public', 'unlisted')),
    CONSTRAINT chk_apis_status     CHECK (status IN ('draft', 'pending_review', 'published', 'deprecated', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_apis_provider   ON catalog.apis (provider_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_apis_category   ON catalog.apis (category_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_apis_status     ON catalog.apis (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_apis_slug       ON catalog.apis (slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_apis_published  ON catalog.apis (status, visibility) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS catalog.api_tags (
    api_id UUID NOT NULL REFERENCES catalog.apis(id) ON DELETE CASCADE,
    tag    VARCHAR(50) NOT NULL,

    PRIMARY KEY (api_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_api_tags_tag ON catalog.api_tags (tag);
