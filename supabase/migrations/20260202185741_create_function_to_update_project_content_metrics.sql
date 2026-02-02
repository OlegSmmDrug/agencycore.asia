/*
  # Create Function to Update Project Content Metrics from Publications

  1. Purpose
    - Automatically update project.content_metrics fact counts based on content_publications
    - Preserve existing plan values
    - Only update facts for Post, Stories, Reels

  2. Usage
    - Call manually: SELECT update_content_metrics_from_publications('project_id')
    - Or call for all projects with content: SELECT update_all_content_metrics()
*/

CREATE OR REPLACE FUNCTION update_content_metrics_from_publications(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_metrics jsonb;
  v_new_metrics jsonb;
  v_posts_count int := 0;
  v_stories_count int := 0;
  v_reels_count int := 0;
BEGIN
  -- Get current metrics
  SELECT content_metrics INTO v_current_metrics
  FROM projects
  WHERE id = p_project_id;

  -- Get fact counts from content_publications
  SELECT 
    COALESCE(SUM(CASE WHEN content_type = 'Post' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN content_type = 'Stories' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN content_type = 'Reels' THEN 1 ELSE 0 END), 0)
  INTO v_posts_count, v_stories_count, v_reels_count
  FROM content_publications
  WHERE project_id = p_project_id;

  -- Start with current metrics or empty object
  v_new_metrics := COALESCE(v_current_metrics, '{}'::jsonb);

  -- Update Post fact (preserve plan)
  IF v_new_metrics ? 'Post' THEN
    v_new_metrics := jsonb_set(
      v_new_metrics,
      '{Post,fact}',
      to_jsonb(v_posts_count)
    );
  ELSE
    v_new_metrics := jsonb_set(
      v_new_metrics,
      '{Post}',
      jsonb_build_object('plan', 0, 'fact', v_posts_count)
    );
  END IF;

  -- Update Stories fact (preserve plan)
  IF v_new_metrics ? 'Stories' THEN
    v_new_metrics := jsonb_set(
      v_new_metrics,
      '{Stories,fact}',
      to_jsonb(v_stories_count)
    );
  ELSE
    v_new_metrics := jsonb_set(
      v_new_metrics,
      '{Stories}',
      jsonb_build_object('plan', 0, 'fact', v_stories_count)
    );
  END IF;

  -- Update Reels fact (preserve plan)
  IF v_new_metrics ? 'Reels' THEN
    v_new_metrics := jsonb_set(
      v_new_metrics,
      '{Reels,fact}',
      to_jsonb(v_reels_count)
    );
  ELSE
    v_new_metrics := jsonb_set(
      v_new_metrics,
      '{Reels}',
      jsonb_build_object('plan', 0, 'fact', v_reels_count)
    );
  END IF;

  -- Update project
  UPDATE projects
  SET content_metrics = v_new_metrics
  WHERE id = p_project_id;

  RETURN v_new_metrics;
END;
$$;

-- Function to update all projects with content_publications
CREATE OR REPLACE FUNCTION update_all_content_metrics()
RETURNS TABLE(project_id uuid, project_name text, updated_metrics jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    update_content_metrics_from_publications(p.id)
  FROM projects p
  WHERE EXISTS (
    SELECT 1 FROM content_publications cp WHERE cp.project_id = p.id
  )
  ORDER BY p.name;
END;
$$;