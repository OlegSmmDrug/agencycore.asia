/*
  # Add content calendar fields to tasks table

  1. New Columns
    - `media_urls` (text array) - URLs to media files for posts/reels/stories
    - `post_text` (text) - The text content for the publication
    - `proof_link` (text) - Link to the published content as proof

  2. Notes
    - These fields support the content calendar feature
    - Used for Post, Reels, and Stories task types
*/

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS media_urls text[] DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS post_text text DEFAULT '';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS proof_link text DEFAULT '';
