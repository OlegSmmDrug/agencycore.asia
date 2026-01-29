/*
  # Enable RLS on Notes and Clean Up Duplicate Indexes

  1. Security Fixes
    - Enable Row Level Security on notes table
    - Policies already exist but RLS was disabled

  2. Performance Optimization
    - Remove duplicate index on project_roadmap_stages
    - Keep idx_project_roadmap_stages_project_id, drop idx_project_roadmap_stages_project
*/

-- Enable RLS on notes table (critical security fix)
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Remove duplicate index
DROP INDEX IF EXISTS idx_project_roadmap_stages_project;