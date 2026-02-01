/*
  # Fix LiveDune Sync Function - Remove ON CONFLICT

  Changes the sync function to check for existing records before inserting
  instead of using ON CONFLICT clause.
*/

DROP FUNCTION IF EXISTS sync_livedune_to_publications(uuid);
DROP FUNCTION IF EXISTS sync_livedune_date_range(uuid, date, date);

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
  v_existing_id uuid;
BEGIN
  SELECT u.id INTO v_smm_user_id
  FROM users u
  JOIN projects p ON p.organization_id = u.organization_id
  WHERE p.id = p_project_id
    AND u.job_title = 'СММ'
    AND u.id = ANY(p.team_ids)
  LIMIT 1;

  IF v_smm_user_id IS NULL THEN
    SELECT u.id INTO v_smm_user_id
    FROM users u
    JOIN projects p ON p.organization_id = u.organization_id
    WHERE p.id = p_project_id
      AND u.job_title = 'СММ'
    LIMIT 1;
  END IF;

  FOR v_cache_record IN
    SELECT *
    FROM livedune_content_cache
    WHERE project_id = p_project_id
    ORDER BY published_date, synced_at
  LOOP
    v_content_type := CASE v_cache_record.content_type
      WHEN 'post' THEN 'Post'
      WHEN 'story' THEN 'Stories '
      WHEN 'reels' THEN 'Reels Production'
      ELSE v_cache_record.content_type
    END;

    SELECT id INTO v_existing_id
    FROM content_publications
    WHERE project_id = v_cache_record.project_id
      AND content_type = v_content_type
      AND published_at = (v_cache_record.published_date || ' 12:00:00')::timestamp
      AND assigned_user_id = COALESCE(v_cache_record.user_id, v_smm_user_id)
    LIMIT 1;

    IF v_existing_id IS NULL THEN
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
      );
      v_synced_count := v_synced_count + 1;
    END IF;
  END LOOP;

  RETURN v_synced_count;
END;
$$;

CREATE OR REPLACE FUNCTION sync_livedune_date_range(
  p_project_id uuid,
  p_date_from date,
  p_date_to date
)
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
  v_existing_id uuid;
BEGIN
  SELECT u.id INTO v_smm_user_id
  FROM users u
  JOIN projects p ON p.organization_id = u.organization_id
  WHERE p.id = p_project_id
    AND u.job_title = 'СММ'
    AND u.id = ANY(p.team_ids)
  LIMIT 1;

  IF v_smm_user_id IS NULL THEN
    SELECT u.id INTO v_smm_user_id
    FROM users u
    JOIN projects p ON p.organization_id = u.organization_id
    WHERE p.id = p_project_id
      AND u.job_title = 'СММ'
    LIMIT 1;
  END IF;

  FOR v_cache_record IN
    SELECT *
    FROM livedune_content_cache
    WHERE project_id = p_project_id
      AND published_date >= p_date_from
      AND published_date <= p_date_to
    ORDER BY published_date, synced_at
  LOOP
    v_content_type := CASE v_cache_record.content_type
      WHEN 'post' THEN 'Post'
      WHEN 'story' THEN 'Stories '
      WHEN 'reels' THEN 'Reels Production'
      ELSE v_cache_record.content_type
    END;

    SELECT id INTO v_existing_id
    FROM content_publications
    WHERE project_id = v_cache_record.project_id
      AND content_type = v_content_type
      AND published_at = (v_cache_record.published_date || ' 12:00:00')::timestamp
      AND assigned_user_id = COALESCE(v_cache_record.user_id, v_smm_user_id)
    LIMIT 1;

    IF v_existing_id IS NULL THEN
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
      );
      v_synced_count := v_synced_count + 1;
    END IF;
  END LOOP;

  RETURN v_synced_count;
END;
$$;
