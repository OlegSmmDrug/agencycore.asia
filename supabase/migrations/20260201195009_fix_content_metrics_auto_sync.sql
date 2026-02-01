/*
  # Автоматическая синхронизация content_metrics из content_publications
  
  1. Новые функции
    - `sync_content_metrics_from_publications(project_id)` - синхронизирует метрики из публикаций
    - `sync_all_content_metrics()` - синхронизирует все проекты
  
  2. Назначение
    - Автоматически обновляет content_metrics.fact на основе content_publications
    - Учитывает период проекта (start_date...текущая дата)
    - Сопоставляет типы контента (post, reels, story) с ключами метрик
*/

-- Функция синхронизации метрик для одного проекта
CREATE OR REPLACE FUNCTION sync_content_metrics_from_publications(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project record;
  v_content_metrics jsonb;
  v_key text;
  v_metric jsonb;
  v_count int;
  v_content_type text;
BEGIN
  -- Получаем проект
  SELECT id, content_metrics, start_date INTO v_project
  FROM projects
  WHERE id = p_project_id;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Если нет метрик, не обновляем
  IF v_project.content_metrics IS NULL OR jsonb_typeof(v_project.content_metrics) != 'object' THEN
    RETURN v_project.content_metrics;
  END IF;
  
  v_content_metrics := v_project.content_metrics;
  
  -- Проходим по всем метрикам
  FOR v_key, v_metric IN SELECT * FROM jsonb_each(v_project.content_metrics)
  LOOP
    -- Определяем тип контента по ключу
    v_content_type := NULL;
    
    IF v_key ILIKE '%post%' THEN
      v_content_type := 'post';
    ELSIF v_key ILIKE '%reel%' THEN
      v_content_type := 'reels';
    ELSIF v_key ILIKE '%stor%' THEN
      v_content_type := 'story';
    END IF;
    
    -- Если нашли соответствие, подсчитываем публикации
    IF v_content_type IS NOT NULL THEN
      SELECT COUNT(*) INTO v_count
      FROM content_publications
      WHERE project_id = p_project_id
        AND content_type = v_content_type
        AND published_at >= v_project.start_date
        AND published_at <= CURRENT_DATE;
      
      -- Обновляем fact в метрике
      v_content_metrics := jsonb_set(
        v_content_metrics,
        ARRAY[v_key, 'fact'],
        to_jsonb(v_count)
      );
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

-- Функция массовой синхронизации всех проектов
CREATE OR REPLACE FUNCTION sync_all_content_metrics()
RETURNS TABLE(project_id uuid, project_name text, updated boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH updated_projects AS (
    SELECT 
      p.id,
      p.name,
      sync_content_metrics_from_publications(p.id) IS NOT NULL as is_updated
    FROM projects p
    WHERE p.content_metrics IS NOT NULL
      AND jsonb_typeof(p.content_metrics) = 'object'
      AND p.end_date >= CURRENT_DATE - INTERVAL '60 days'
  )
  SELECT 
    up.id,
    up.name,
    up.is_updated
  FROM updated_projects up
  WHERE up.is_updated = true;
END;
$$;

COMMENT ON FUNCTION sync_content_metrics_from_publications IS 
'Синхронизирует content_metrics проекта из таблицы content_publications';

COMMENT ON FUNCTION sync_all_content_metrics IS 
'Массово синхронизирует content_metrics всех активных проектов из content_publications';
