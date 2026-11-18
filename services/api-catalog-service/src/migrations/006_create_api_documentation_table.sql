-- API Catalog service: api_documentation

CREATE TABLE IF NOT EXISTS catalog.api_documentation (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_id     UUID NOT NULL REFERENCES catalog.apis(id) ON DELETE CASCADE,
    type       VARCHAR(50) NOT NULL,
    title      VARCHAR(200),
    content    TEXT,
    format     VARCHAR(20),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_docs_type   CHECK (type IN ('openapi', 'swagger', 'markdown', 'link')),
    CONSTRAINT chk_docs_format CHECK (format IS NULL OR format IN ('json', 'yaml', 'md', 'url'))
);

CREATE INDEX IF NOT EXISTS idx_api_documentation_api ON catalog.api_documentation (api_id);
