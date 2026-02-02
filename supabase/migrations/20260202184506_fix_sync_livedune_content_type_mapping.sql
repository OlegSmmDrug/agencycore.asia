/*
  # Fix LiveDune Content Type Mapping

  1. Updates
    - Fix sync_livedune_to_publications function to map content types correctly
    - 'post' -> 'Post' (correct)
    - 'story' -> 'Stories' (remove space)
    - 'reels' -> 'Reels' (normalize)

  2. Purpose
    - Ensure content_publications uses normalized keys matching project.content_metrics
    - Fix auto-sync to correctly update counts
*/

CREATE OR REPLACE FUNCTION sync_livedune_to_publications(p_project_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_synced_count integer := 0;
  v_smm_user_id uuid;
  v_cache_record record;
  v_content_type text;
BEGIN
  -- Get the SMM user for this project (first team member with SMM job title)
  SELECT u.id INTO v_smm_user_id
  FROM users u
  JOIN projects p ON p.organization_id = u.organization_id
  WHERE p.id = p_project_id
    AND (u.job_title ILIKE '%SMM%' OR u.job_title ILIKE '%Контент%')
    AND u.id = ANY(p.team_ids)
  LIMIT 1;

  -- If no SMM found in team, get any SMM from organization
  IF v_smm_user_id IS NULL THEN
    SELECT u.id INTO v_smm_user_id
    FROM users u
    JOIN projects p ON p.organization_id = u.organization_id
    WHERE p.id = p_project_id
      AND (u.job_title ILIKE '%SMM%' OR u.job_title ILIKE '%Контент%')
    LIMIT 1;
  END IF;

  -- Loop through all cached content for this project
  FOR v_cache_record IN
    SELECT *
    FROM livedune_content_cache
    WHERE project_id = p_project_id
    ORDER BY published_date, synced_at
  LOOP
    -- Map content_type correctly to normalized keys
    v_content_type := CASE v_cache_record.content_type
      WHEN 'post' THEN 'Post'
      WHEN 'story' THEN 'Stories'
      WHEN 'reels' THEN 'Reels'
      ELSE v_cache_record.content_type
    END;

    -- Insert or update content_publications
    INSERT INTO content_publications (
      project_id,
      assigned_user_id,
      content_type,
      description,
      published_at,
      organization_id,
      created_at
    )
    VALUES (
      v_cache_record.project_id,
      COALESCE(v_cache_record.user_id, v_smm_user_id),
      v_content_type,
      COALESCE(v_cache_record.caption, 'Синхронизировано из LiveDune'),
      (v_cache_record.published_date || ' 12:00:00')::timestamp,
      v_cache_record.organization_id,
      NOW()
    )
    ON CONFLICT (project_id, content_type, published_at, assigned_user_id)
    DO UPDATE SET
      description = COALESCE(EXCLUDED.description, content_publications.description),
      organization_id = EXCLUDED.organization_id
    WHERE content_publications.description = 'Синхронизировано из LiveDune'
       OR content_publications.description IS NULL;

    v_synced_count := v_synced_count + 1;
  END LOOP;

  RETURN v_synced_count;
END;
$$;