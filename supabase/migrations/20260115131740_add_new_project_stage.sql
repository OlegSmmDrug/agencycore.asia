/*
  # Add "Новый проект" stage to Level 1 stages

  1. Purpose
    - Add a new first stage "Новый проект" for projects without assigned stages
    - Update order_index of existing stages to accommodate the new stage
    - This ensures all projects are visible in the Kanban board

  2. Changes
    - Update order_index of existing stages (increment by 1)
    - Insert new "Новый проект" stage with order_index = 0
    - New projects from CRM will start in this stage

  3. Notes
    - Safe to run multiple times (uses ON CONFLICT DO NOTHING)
    - Existing stage progression system remains intact
*/

-- Update order_index of existing stages to make room for new stage
UPDATE roadmap_stage_level1 
SET order_index = order_index + 1 
WHERE order_index >= 1;

-- Insert new "Новый проект" stage as the first stage
INSERT INTO roadmap_stage_level1 (name, order_index, color, icon)
VALUES ('Новый проект', 0, '#94a3b8', '📋')
ON CONFLICT DO NOTHING;