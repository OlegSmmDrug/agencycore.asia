/*
  # Create LiveDune Data Cache System

  1. New Tables
    - `livedune_content_cache`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to projects)
      - `account_id` (text) - LiveDune account ID
      - `content_type` (text) - Type: 'post', 'story', 'reels'
      - `content_id` (text) - LiveDune content ID
      - `published_date` (date) - When content was published
      - `metrics` (jsonb) - All metrics (likes, comments, views, etc.)
      - `thumbnail_url` (text) - Content thumbnail
      - `permalink` (text) - Link to content
      - `caption` (text) - Post caption
      - `user_id` (uuid, foreign key) - User who created content
      - `task_id` (uuid, foreign key) - Related task if any
      - `organization_id` (uuid, foreign key to organizations)
      - `synced_at` (timestamptz) - Last sync time
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Indexes
    - Index on project_id for fast project lookups
    - Index on published_date for time-based queries
    - Index on content_type for filtering by type
    - Composite index on (project_id, published_date) for period queries
    - Index on user_id for user content tracking
    - Index on organization_id for tenant isolation

  3. Security
    - Disable RLS for simple auth compatibility
*/

CREATE TABLE IF NOT EXISTS livedune_content_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('post', 'story', 'reels')),
  content_id text NOT NULL,
  published_date date NOT NULL,
  metrics jsonb DEFAULT '{}'::jsonb,
  thumbnail_url text,
  permalink text,
  caption text,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  synced_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(project_id, content_id, content_type)
);

CREATE INDEX IF NOT EXISTS idx_livedune_cache_project_id ON livedune_content_cache(project_id);
CREATE INDEX IF NOT EXISTS idx_livedune_cache_published_date ON livedune_content_cache(published_date);
CREATE INDEX IF NOT EXISTS idx_livedune_cache_content_type ON livedune_content_cache(content_type);
CREATE INDEX IF NOT EXISTS idx_livedune_cache_project_date ON livedune_content_cache(project_id, published_date);
CREATE INDEX IF NOT EXISTS idx_livedune_cache_user_id ON livedune_content_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_livedune_cache_organization_id ON livedune_content_cache(organization_id);
CREATE INDEX IF NOT EXISTS idx_livedune_cache_task_id ON livedune_content_cache(task_id);

ALTER TABLE livedune_content_cache DISABLE ROW LEVEL SECURITY;