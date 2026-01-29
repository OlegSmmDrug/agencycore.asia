/*
  # Notes System for Personal and Project Notes
  
  This migration creates a notes system with support for personal and project-level notes.
  
  1. New Tables
    - `notes` - Notes storage
      - `id` (uuid, primary key)
      - `title` (text) - Note title
      - `content` (text) - Note content (HTML)
      - `author_id` (uuid, FK -> users) - Note author
      - `project_id` (uuid, FK -> projects) - Optional project association
      - `tags` (text[]) - Tags for categorization
      - `is_pinned` (boolean) - Whether note is pinned
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      
  2. Security
    - Enable RLS on notes table
    - Users can read their own notes
    - Users can read project notes if they are team members
    - Users can only modify their own notes
*/

-- Notes table
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  content text DEFAULT '',
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  tags text[] DEFAULT ARRAY[]::text[],
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notes"
  ON notes FOR SELECT
  TO authenticated
  USING (author_id = auth.uid());

CREATE POLICY "Users can read project notes if team member"
  ON notes FOR SELECT
  TO authenticated
  USING (
    project_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = notes.project_id 
      AND auth.uid() = ANY(projects.team_ids)
    )
  );

CREATE POLICY "Users can insert own notes"
  ON notes FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Users can update own notes"
  ON notes FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Users can delete own notes"
  ON notes FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notes_author_id ON notes(author_id);
CREATE INDEX IF NOT EXISTS idx_notes_project_id ON notes(project_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_is_pinned ON notes(is_pinned) WHERE is_pinned = true;