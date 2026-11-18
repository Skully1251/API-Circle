-- API Catalog service: api_endpoints

CREATE TABLE IF NOT EXISTS catalog.api_endpoints (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_version_id      UUID NOT NULL REFERENCES catalog.api_versions(id) ON DELETE CASCADE,
    path                VARCHAR(500) NOT NULL,
    method              VARCHAR(10) NOT NULL,
    summary             VARCHAR(500),
    description         TEXT,
    request_body_schema JSONB,
    response_schema     JSONB,
    query_parameters    JSONB,
    path_parameters     JSONB,
    headers             JSONB,
    is_deprecated       BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_endpoints_version_path_method UNIQUE (api_version_id, path, method),
    CONSTRAINT chk_endpoints_method CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'))
);

CREATE INDEX IF NOT EXISTS idx_api_endpoints_version ON catalog.api_endpoints (api_version_id);
