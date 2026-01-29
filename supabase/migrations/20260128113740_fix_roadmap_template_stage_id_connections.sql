/*
  # Fix Roadmap Template Stage ID Connections

  1. Problem
    - Project roadmap stages were created without template_stage_id
    - This prevents tasks from being auto-created when stage starts
    - Need to restore connections by matching stage names and order

  2. Solution
    - Match project stages with template stages by:
      - project_roadmap_templates.template_id
      - stage name and order_index
    - Update project_roadmap_stages.template_stage_id

  3. Notes
    - This is safe to run multiple times
    - Only updates stages where template_stage_id is NULL
    - Matches by exact name and order_index
*/

-- Update project_roadmap_stages with correct template_stage_id
WITH matched_stages AS (
  SELECT 
    prs.id as project_stage_id,
    rts.id as template_stage_id
  FROM project_roadmap_stages prs
  JOIN project_roadmap_templates prt ON prt.project_id = prs.project_id
  JOIN roadmap_template_stages rts ON 
    rts.template_id = prt.template_id
    AND rts.name = prs.name
    AND rts.order_index = prs.order_index
  WHERE prs.template_stage_id IS NULL
)
UPDATE project_roadmap_stages prs
SET template_stage_id = ms.template_stage_id
FROM matched_stages ms
WHERE prs.id = ms.project_stage_id;