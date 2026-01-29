/*
  # Remove "Новый проект" stage from Level 1 stages

  1. Purpose
    - Remove the "Новый проект" (New Project) stage from the roadmap
    - Delete all project status records for this stage
    - Update order_index of remaining stages and project statuses

  2. Changes
    - Delete all project_level1_stage_status records for "Новый проект"
    - Delete "Новый проект" stage from roadmap_stage_level1
    - Decrement order_index for remaining stages and project statuses

  3. Data Safety
    - Projects will start from "Подготовка" stage instead
    - All other stage progression is preserved
*/

-- Delete all project status records for "Новый проект"
DELETE FROM project_level1_stage_status 
WHERE level1_stage_id = 'aa4d5671-23cd-43fa-a3f2-3c02c1cefc18';

-- Delete "Новый проект" stage
DELETE FROM roadmap_stage_level1 
WHERE id = 'aa4d5671-23cd-43fa-a3f2-3c02c1cefc18';

-- Update order_index for remaining stages (decrement by 1)
UPDATE roadmap_stage_level1
SET order_index = order_index - 1
WHERE order_index > 0;

-- Update order_index for all project status records (decrement by 1)
UPDATE project_level1_stage_status
SET order_index = order_index - 1
WHERE order_index > 0;
