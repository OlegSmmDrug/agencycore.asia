/*
  # Create Flexible Content Tracking System

  1. New Tables
    - `service_task_mappings`
      - Maps calculator services to task types and display metrics
      - Allows dynamic configuration of what services track in the dashboard
      - Uses service ID (not name) to survive service renaming
      
  2. Changes to Existing Tables
    - `projects`
      - Add `content_metrics` JSONB field for dynamic metric storage
      - Add `last_content_sync_at` timestamp for tracking sync status
      - Keep legacy fields (posts_plan, reels_plan, etc.) for backward compatibility
      
  3. Security
    - Enable RLS on `service_task_mappings`
    - Add policies for organization-scoped access
    
  4. Data Migration
    - Migrate existing data from legacy fields to content_metrics
    - Pre-populate mappings for existing services
*/

-- Create service_task_mappings table
CREATE TABLE IF NOT EXISTS service_task_mappings (
  id text PRIMARY KEY DEFAULT ('map_' || gen_random_uuid()::text),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_id text NOT NULL,
  task_type text,
  metric_label text NOT NULL,
  show_in_widget boolean DEFAULT true,
  sort_order integer DEFAULT 999,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, service_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_task_mappings_org ON service_task_mappings(organization_id);
CREATE INDEX IF NOT EXISTS idx_service_task_mappings_service ON service_task_mappings(service_id);
CREATE INDEX IF NOT EXISTS idx_service_task_mappings_widget ON service_task_mappings(organization_id, show_in_widget);

-- Enable RLS
ALTER TABLE service_task_mappings ENABLE ROW LEVEL SECURITY;

-- Add content_metrics to projects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'content_metrics'
  ) THEN
    ALTER TABLE projects ADD COLUMN content_metrics jsonb DEFAULT '{}'::jsonb;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'last_content_sync_at'
  ) THEN
    ALTER TABLE projects ADD COLUMN last_content_sync_at timestamptz;
  END IF;
END $$;

-- Migrate existing data from legacy fields to content_metrics
UPDATE projects
SET content_metrics = jsonb_build_object(
  'posts', jsonb_build_object('plan', COALESCE(posts_plan, 0), 'fact', COALESCE(posts_fact, 0)),
  'reels', jsonb_build_object('plan', COALESCE(reels_plan, 0), 'fact', COALESCE(reels_fact, 0)),
  'stories', jsonb_build_object('plan', COALESCE(stories_plan, 0), 'fact', COALESCE(stories_fact, 0))
)
WHERE content_metrics = '{}'::jsonb OR content_metrics IS NULL;

-- Seed mappings for existing services
-- This will find existing services named "Posts", "Reels", "Stories" and create mappings
INSERT INTO service_task_mappings (organization_id, service_id, task_type, metric_label, show_in_widget, sort_order)
SELECT DISTINCT
  cs.organization_id,
  cs.id as service_id,
  CASE 
    WHEN LOWER(cs.name) LIKE '%post%' AND LOWER(cs.name) NOT LIKE '%repost%' THEN 'content_post'
    WHEN LOWER(cs.name) LIKE '%reel%' THEN 'content_reel'
    WHEN LOWER(cs.name) LIKE '%stor%' THEN 'content_story'
    ELSE NULL
  END as task_type,
  cs.name as metric_label,
  true as show_in_widget,
  CASE 
    WHEN LOWER(cs.name) LIKE '%post%' AND LOWER(cs.name) NOT LIKE '%repost%' THEN 1
    WHEN LOWER(cs.name) LIKE '%reel%' THEN 2
    WHEN LOWER(cs.name) LIKE '%stor%' THEN 3
    ELSE 999
  END as sort_order
FROM calculator_services cs
WHERE 
  cs.is_active = true
  AND (
    LOWER(cs.name) LIKE '%post%' 
    OR LOWER(cs.name) LIKE '%reel%'
    OR LOWER(cs.name) LIKE '%stor%'
  )
ON CONFLICT (organization_id, service_id) DO NOTHING;