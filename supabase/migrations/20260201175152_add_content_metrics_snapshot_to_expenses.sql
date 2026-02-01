/*
  # Add Content Metrics Snapshot to Project Expenses

  1. Changes
    - Add `content_metrics_snapshot` JSON field to `project_expenses`
    - This will store historical content metrics (Posts, Stories, Reels) for each month
    - Allows analyzing content publication history

  2. Purpose
    - When loading expenses for a specific month, we calculate content metrics from `content_publications`
    - Store the snapshot in `project_expenses` for historical analysis
    - User can navigate through months and see actual content metrics for each period
*/

-- Add content_metrics_snapshot field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_expenses' AND column_name = 'content_metrics_snapshot'
  ) THEN
    ALTER TABLE project_expenses ADD COLUMN content_metrics_snapshot jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Function to calculate content metrics for a specific project and month
CREATE OR REPLACE FUNCTION calculate_content_metrics_for_month(
  p_project_id uuid,
  p_month text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_date timestamptz;
  v_end_date timestamptz;
  v_metrics jsonb := '{}'::jsonb;
  v_content_type text;
  v_count int;
BEGIN
  -- Parse month string (YYYY-MM) to date range
  v_start_date := (p_month || '-01')::timestamptz;
  v_end_date := (v_start_date + interval '1 month');

  -- Count publications by content_type for this month
  FOR v_content_type, v_count IN
    SELECT 
      content_type,
      COUNT(*)::int
    FROM content_publications
    WHERE project_id = p_project_id
      AND published_at >= v_start_date
      AND published_at < v_end_date
    GROUP BY content_type
  LOOP
    v_metrics := jsonb_set(
      v_metrics,
      ARRAY[v_content_type],
      jsonb_build_object(
        'plan', 0,
        'fact', v_count
      )
    );
  END LOOP;

  RETURN v_metrics;
END;
$$;

COMMENT ON FUNCTION calculate_content_metrics_for_month IS 
'Calculates content publication metrics (Posts, Stories, Reels, etc.) for a specific project and month from content_publications table';
