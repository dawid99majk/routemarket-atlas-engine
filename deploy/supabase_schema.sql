-- Table for Atlas Projects
CREATE TABLE IF NOT EXISTS atlas_projects (
    slug TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for Atlas Artifacts (Sources, Claims, Summary, etc.)
CREATE TABLE IF NOT EXISTS atlas_artifacts (
    project_slug TEXT REFERENCES atlas_projects(slug) ON DELETE CASCADE,
    type TEXT NOT NULL,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_slug, type)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_atlas_artifacts_project_slug ON atlas_artifacts(project_slug);
