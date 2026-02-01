/*
  # Функция ручной синхронизации контента для проектов с Livedune
  
  1. Назначение
    - Для проектов где fact = 0 но есть Livedune токен
    - Обновляет content_metrics из content_publications
*/

-- Функция для обновления метрик одного проекта из content_publications
CREATE OR REPLACE FUNCTION update_project_content_metrics(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project record;
  v_content_metrics jsonb;
  v_posts_count int;
  v_reels_count int;
  v_stories_count int;
  v_key text;
  v_value jsonb;
BEGIN
  -- Получаем проект
  SELECT id, content_metrics, start_date, organization_id
  INTO v_project
  FROM projects
  WHERE id = p_project_id;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Подсчитываем публикации
  SELECT 
    COUNT(*) FILTER (WHERE content_type = 'post'),
    COUNT(*) FILTER (WHERE content_type IN ('reels', 'reel')),
    COUNT(*) FILTER (WHERE content_type IN ('story', 'stories'))
  INTO v_posts_count, v_reels_count, v_stories_count
  FROM content_publications
  WHERE project_id = p_project_id
    AND published_at >= v_project.start_date
    AND published_at <= CURRENT_DATE;
  
  -- Если нет публикаций, возвращаем NULL
  IF v_posts_count = 0 AND v_reels_count = 0 AND v_stories_count = 0 THEN
    RETURN NULL;
  END IF;
  
  -- Обновляем метрики
  v_content_metrics := v_project.content_metrics;
  
  -- Обходим все ключи метрик и обновляем fact
  FOR v_key, v_value IN SELECT * FROM jsonb_each(v_project.content_metrics)
  LOOP
    IF v_key ILIKE '%post%' THEN
      v_content_metrics := jsonb_set(v_content_metrics, ARRAY[v_key, 'fact'], to_jsonb(v_posts_count));
    ELSIF v_key ILIKE '%reel%' THEN
      v_content_metrics := jsonb_set(v_content_metrics, ARRAY[v_key, 'fact'], to_jsonb(v_reels_count));
    ELSIF v_key ILIKE '%stor%' THEN
      v_content_metrics := jsonb_set(v_content_metrics, ARRAY[v_key, 'fact'], to_jsonb(v_stories_count));
    END IF;
  END LOOP;
  
  -- Сохраняем обновленные метрики
  UPDATE projects
  SET content_metrics = v_content_metrics,
      content_last_calculated_at = NOW()
  WHERE id = p_project_id;
  
  RETURN v_content_metrics;
END;
$$;

COMMENT ON FUNCTION update_project_content_metrics IS 
'Обновляет content_metrics проекта на основе данных в content_publications';
