/*
  # Исправление подсчета метрик контента - использовать последние 30 дней
  
  1. Проблема
    - Функция считает от start_date проекта до сегодня
    - Но пользователи ожидают видеть данные за последние 30 дней (как в Livedune)
    
  2. Решение
    - Изменить период подсчета на последние 30 дней
*/

DROP FUNCTION IF EXISTS update_project_content_metrics(uuid);

CREATE OR REPLACE FUNCTION update_project_content_metrics(
  p_project_id uuid,
  p_days_back int DEFAULT 30
)
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
  v_start_date date;
  v_end_date date;
BEGIN
  -- Получаем проект
  SELECT id, content_metrics, start_date, organization_id
  INTO v_project
  FROM projects
  WHERE id = p_project_id;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Определяем период: последние N дней или от start_date (что позже)
  v_end_date := CURRENT_DATE;
  v_start_date := GREATEST(
    v_project.start_date,
    CURRENT_DATE - p_days_back
  );
  
  RAISE NOTICE 'Counting publications from % to %', v_start_date, v_end_date;
  
  -- Подсчитываем посты
  SELECT COUNT(*)
  INTO v_posts_count
  FROM content_publications
  WHERE project_id = p_project_id
    AND content_type = 'post'
    AND published_at::date >= v_start_date
    AND published_at::date <= v_end_date;
  
  -- Подсчитываем рилс
  SELECT COUNT(*)
  INTO v_reels_count
  FROM content_publications
  WHERE project_id = p_project_id
    AND content_type IN ('reels', 'reel')
    AND published_at::date >= v_start_date
    AND published_at::date <= v_end_date;
  
  -- Подсчитываем сторис
  SELECT COUNT(*)
  INTO v_stories_count
  FROM content_publications
  WHERE project_id = p_project_id
    AND content_type IN ('story', 'stories')
    AND published_at::date >= v_start_date
    AND published_at::date <= v_end_date;
  
  RAISE NOTICE 'Counts: posts=%, reels=%, stories=%', v_posts_count, v_reels_count, v_stories_count;
  
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
'Обновляет content_metrics проекта на основе данных в content_publications за последние N дней (по умолчанию 30)';
