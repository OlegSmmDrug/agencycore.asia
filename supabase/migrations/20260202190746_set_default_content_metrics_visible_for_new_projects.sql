/*
  # Set Default content_metrics_visible for Projects

  1. Purpose
    - Ensure all new projects automatically get content_metrics_visible set to Post, Stories, Reels
    - This enables the "Детализация расходов по услугам" panel to display by default
    
  2. Changes
    - Add DEFAULT value to content_metrics_visible column
    - Ensure all existing projects without this field get it set
*/

-- Set default for new projects
ALTER TABLE projects
ALTER COLUMN content_metrics_visible 
SET DEFAULT ARRAY['Post', 'Stories', 'Reels'];

-- Update any remaining NULL values
UPDATE projects
SET content_metrics_visible = ARRAY['Post', 'Stories', 'Reels']
WHERE content_metrics_visible IS NULL OR array_length(content_metrics_visible, 1) IS NULL;