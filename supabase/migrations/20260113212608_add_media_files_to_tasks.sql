/*
  # Add media files support to tasks

  1. New Columns
    - `media_files` (jsonb) - Array of media file objects with metadata
      Structure: [{id, name, url, type, size, duration, thumbnail_url, uploaded_by, uploaded_at}]

  2. Notes
    - Supports storing multiple photos and videos per task
    - Includes metadata for proper display and management
    - Used for content calendar tasks (Post, Reels, Stories)
*/

-- Add media_files column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS media_files jsonb DEFAULT '[]'::jsonb;

-- Add index for better query performance on media_files
CREATE INDEX IF NOT EXISTS idx_tasks_media_files ON tasks USING gin(media_files);
