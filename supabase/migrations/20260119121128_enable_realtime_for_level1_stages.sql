/*
  # Enable Realtime for Level 1 Stage Status

  1. Changes
    - Enable realtime for project_level1_stage_status table
    - This allows real-time synchronization between roadmap view and race track
*/

-- Enable realtime for project_level1_stage_status
ALTER PUBLICATION supabase_realtime ADD TABLE project_level1_stage_status;
