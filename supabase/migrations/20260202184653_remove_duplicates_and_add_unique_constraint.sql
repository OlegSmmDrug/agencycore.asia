/*
  # Remove Duplicates and Add Unique Constraint

  1. Changes
    - Remove duplicate content_publications keeping only the latest one
    - Add unique constraint on (project_id, content_type, published_at, assigned_user_id)

  2. Purpose
    - Clean up duplicate data
    - Enable upsert operations for LiveDune sync
    - Ensure data integrity
*/

-- Delete duplicates keeping only the latest record (highest id)
DELETE FROM content_publications
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY project_id, content_type, published_at, assigned_user_id
        ORDER BY created_at DESC, id DESC
      ) as rn
    FROM content_publications
  ) subq
  WHERE rn > 1
);

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS content_publications_unique_idx
ON content_publications (project_id, content_type, published_at, assigned_user_id);