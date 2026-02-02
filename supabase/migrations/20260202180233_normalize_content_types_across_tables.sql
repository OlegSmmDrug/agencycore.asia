/*
  # Normalize Content Types Across All Tables
  
  ## Summary
  This migration standardizes content type values across all tables to use consistent naming:
  - Post (not 'post', 'posts_', 'Posts')
  - Stories (not 'story', 'stories_', 'Stories ')
  - Reels (not 'reels', 'reels_production', 'Reels Production')
  
  ## Changes
  1. content_publications table:
     - Update 'post' -> 'Post'
     - Update 'story' -> 'Stories'
     - Update 'reels' -> 'Reels'
  
  2. salary_schemes.kpi_rules:
     - Update 'Stories ' (with space) -> 'Stories'
     - Update 'Reels Production' -> 'Reels'
     - Update 'Posts' -> 'Post'
  
  3. calculator_services:
     - Update 'Stories ' (with space) -> 'Stories'
     - Update 'Reels Production' -> 'Reels'
     - Update 'Posts' -> 'Post'
  
  4. projects.content_metrics:
     - Rename keys: posts_ -> Post, stories_ -> Stories, reels_production -> Reels
  
  5. projects.content_metrics_visible:
     - Update array values to match new naming
  
  ## Security
  No security changes - data normalization only
*/

-- 1. Update content_publications table
UPDATE content_publications 
SET content_type = 'Post' 
WHERE content_type = 'post';

UPDATE content_publications 
SET content_type = 'Stories' 
WHERE content_type IN ('story', 'Stories ');

UPDATE content_publications 
SET content_type = 'Reels' 
WHERE content_type IN ('reels', 'Reels Production');

-- 2. Update salary_schemes.kpi_rules (JSONB array)
UPDATE salary_schemes
SET kpi_rules = (
  SELECT jsonb_agg(
    CASE 
      WHEN rule->>'taskType' = 'Stories ' THEN jsonb_set(rule, '{taskType}', '"Stories"')
      WHEN rule->>'taskType' = 'Reels Production' THEN jsonb_set(rule, '{taskType}', '"Reels"')
      WHEN rule->>'taskType' = 'Posts' THEN jsonb_set(rule, '{taskType}', '"Post"')
      WHEN rule->>'taskType' = 'post' THEN jsonb_set(rule, '{taskType}', '"Post"')
      WHEN rule->>'taskType' = 'story' THEN jsonb_set(rule, '{taskType}', '"Stories"')
      WHEN rule->>'taskType' = 'reels' THEN jsonb_set(rule, '{taskType}', '"Reels"')
      ELSE rule
    END
  )
  FROM jsonb_array_elements(kpi_rules) AS rule
)
WHERE kpi_rules IS NOT NULL 
AND kpi_rules::text ~ '(Stories |Reels Production|Posts|post|story|reels)';

-- 3. Update calculator_services names
UPDATE calculator_services 
SET name = 'Stories' 
WHERE name = 'Stories ';

UPDATE calculator_services 
SET name = 'Reels' 
WHERE name = 'Reels Production';

UPDATE calculator_services 
SET name = 'Post' 
WHERE name = 'Posts';

-- 4. Update projects.content_metrics (JSONB object) - rename keys
UPDATE projects
SET content_metrics = (
  SELECT jsonb_object_agg(
    CASE 
      WHEN key = 'posts_' THEN 'Post'
      WHEN key = 'stories_' THEN 'Stories'
      WHEN key = 'reels_production' THEN 'Reels'
      WHEN key LIKE '%post%' AND key NOT LIKE '%repost%' THEN 'Post'
      WHEN key LIKE '%stor%' THEN 'Stories'
      WHEN key LIKE '%reel%' THEN 'Reels'
      ELSE key
    END,
    value
  )
  FROM jsonb_each(content_metrics)
)
WHERE content_metrics IS NOT NULL 
AND content_metrics::text ~ '(posts_|stories_|reels_production)';

-- 5. Update projects.content_metrics_visible (text array)
UPDATE projects
SET content_metrics_visible = ARRAY(
  SELECT 
    CASE 
      WHEN elem = 'posts_' THEN 'Post'
      WHEN elem = 'stories_' THEN 'Stories'
      WHEN elem = 'reels_production' THEN 'Reels'
      ELSE elem
    END
  FROM unnest(content_metrics_visible) AS elem
)
WHERE content_metrics_visible IS NOT NULL 
AND content_metrics_visible::text ~ '(posts_|stories_|reels_production)';

-- 6. Update project_expenses.content_metrics_snapshot if exists
UPDATE project_expenses
SET content_metrics_snapshot = (
  SELECT jsonb_object_agg(
    CASE 
      WHEN key = 'posts_' THEN 'Post'
      WHEN key = 'stories_' THEN 'Stories'
      WHEN key = 'reels_production' THEN 'Reels'
      ELSE key
    END,
    value
  )
  FROM jsonb_each(content_metrics_snapshot)
)
WHERE content_metrics_snapshot IS NOT NULL 
AND content_metrics_snapshot != '{}'::jsonb
AND content_metrics_snapshot::text ~ '(posts_|stories_|reels_production)';