-- API Catalog service: categories (supports subcategories via parent_id)

CREATE TABLE IF NOT EXISTS catalog.categories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) UNIQUE NOT NULL,
    slug        VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon        VARCHAR(100),
    parent_id   UUID REFERENCES catalog.categories(id) ON DELETE SET NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON catalog.categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug   ON catalog.categories (slug);
