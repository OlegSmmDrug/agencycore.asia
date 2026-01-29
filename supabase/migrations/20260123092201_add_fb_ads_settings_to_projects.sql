/*
  # Add Facebook Ads Settings to Projects

  1. Changes
    - Add `fb_ads_visible_metrics` column to store user-selected metrics for each project
    - This ensures each project has its own separate Facebook Ads configuration
  
  2. Technical Details
    - Column stores array of metric keys as JSONB
    - Default value includes the most commonly used metrics
*/

-- Add column to store visible metrics per project
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS fb_ads_visible_metrics JSONB DEFAULT '["spend", "leads", "cpl", "messages", "roas"]'::jsonb;