/*
  # Sync LiveDune Cache to Content Publications

  1. Purpose
    - Синхронизирует все данные из livedune_content_cache в content_publications
    - Маппирует типы контента из LiveDune в типы для расчета зарплаты
    - Назначает публикации SMM-специалистам из команды проекта

  2. Mapping
    - 'post' → 'Post'
    - 'story' → 'Stories '
    - 'reels' → 'Reels Production'

  3. Important Notes
    - Публикации назначаются SMM-специалистам равномерно
    - Если user_id уже указан в кэше - используется он
    - Если в команде нет SMM - публикации не создаются
*/

DO $$
DECLARE
  v_project RECORD;
  v_cache_item RECORD;
  v_smm_members TEXT[];
  v_assigned_user_id UUID;
  v_index INT := 0;
  v_content_type TEXT;
BEGIN
  -- Получаем все проекты с закэшированным контентом
  FOR v_project IN 
    SELECT DISTINCT project_id, organization_id
    FROM livedune_content_cache
  LOOP
    RAISE NOTICE 'Processing project: %', v_project.project_id;
    
    -- Получаем SMM-специалистов из команды проекта
    SELECT ARRAY_AGG(DISTINCT u.id)
    INTO v_smm_members
    FROM projects p
    CROSS JOIN LATERAL unnest(p.team_ids) AS team_member_id
    JOIN users u ON u.id = team_member_id::uuid
    WHERE p.id = v_project.project_id
      AND (u.job_title ILIKE '%smm%' OR u.job_title ILIKE '%контент%');
    
    IF v_smm_members IS NULL OR array_length(v_smm_members, 1) = 0 THEN
      RAISE NOTICE 'No SMM members found for project %, skipping', v_project.project_id;
      CONTINUE;
    END IF;
    
    RAISE NOTICE 'Found % SMM members', array_length(v_smm_members, 1);
    
    v_index := 0;
    
    -- Синхронизируем каждую запись из кэша
    FOR v_cache_item IN
      SELECT *
      FROM livedune_content_cache
      WHERE project_id = v_project.project_id
      ORDER BY published_date
    LOOP
      -- Определяем пользователя
      IF v_cache_item.user_id IS NOT NULL THEN
        v_assigned_user_id := v_cache_item.user_id;
      ELSE
        -- Распределяем равномерно между SMM-специалистами
        v_assigned_user_id := v_smm_members[(v_index % array_length(v_smm_members, 1)) + 1]::uuid;
        v_index := v_index + 1;
      END IF;
      
      -- Маппим тип контента
      v_content_type := CASE v_cache_item.content_type
        WHEN 'post' THEN 'Post'
        WHEN 'story' THEN 'Stories '
        WHEN 'reels' THEN 'Reels Production'
        ELSE v_cache_item.content_type
      END;
      
      -- Вставляем публикацию (с проверкой на дубликаты)
      INSERT INTO content_publications (
        project_id,
        content_type,
        published_at,
        assigned_user_id,
        organization_id,
        description,
        created_at
      )
      VALUES (
        v_cache_item.project_id,
        v_content_type,
        (v_cache_item.published_date || ' 12:00:00')::timestamptz,
        v_assigned_user_id,
        v_cache_item.organization_id,
        'Synced from LiveDune (' || v_cache_item.content_id || ')',
        NOW()
      )
      ON CONFLICT DO NOTHING;
      
    END LOOP;
    
    RAISE NOTICE 'Completed sync for project %', v_project.project_id;
  END LOOP;
  
  -- Выводим статистику
  RAISE NOTICE '=== Sync Complete ===';
  RAISE NOTICE 'Total publications created: %', (SELECT COUNT(*) FROM content_publications);
END $$;

-- Проверяем результат
SELECT 
  p.name as project_name,
  u.name as user_name,
  cp.content_type,
  COUNT(*) as publications_count
FROM content_publications cp
JOIN projects p ON p.id = cp.project_id
JOIN users u ON u.id = cp.assigned_user_id
GROUP BY p.name, u.name, cp.content_type
ORDER BY p.name, u.name, cp.content_type;
