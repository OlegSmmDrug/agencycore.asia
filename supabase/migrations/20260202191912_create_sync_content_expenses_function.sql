/*
  # Функция для автоматической синхронизации контентных метрик

  1. Новая функция
    - `sync_content_expenses` - синхронизирует Post, Stories, Reels в dynamic_expenses
  
  2. Назначение
    - Автоматически добавляет контентные метрики из content_metrics в dynamic_expenses
    - Использует plan значения из content_metrics
    - Применяет стандартные ставки: Post=800, Stories=500, Reels=800
*/

CREATE OR REPLACE FUNCTION sync_content_expenses(
  p_project_id uuid,
  p_month text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expense_id uuid;
  v_content_metrics jsonb;
  v_dynamic_expenses jsonb;
  v_post_plan int;
  v_stories_plan int;
  v_reels_plan int;
BEGIN
  -- Получаем ID расхода и метрики проекта
  SELECT 
    pe.id,
    p.content_metrics
  INTO 
    v_expense_id,
    v_content_metrics
  FROM project_expenses pe
  JOIN projects p ON p.id = pe.project_id
  WHERE pe.project_id = p_project_id
    AND pe.month = p_month;

  IF v_expense_id IS NULL THEN
    RETURN;
  END IF;

  -- Получаем текущие dynamic_expenses
  SELECT COALESCE(dynamic_expenses, '{}'::jsonb)
  INTO v_dynamic_expenses
  FROM project_expenses
  WHERE id = v_expense_id;

  -- Извлекаем план значения
  v_post_plan := COALESCE((v_content_metrics->'Post'->>'plan')::int, 0);
  v_stories_plan := COALESCE((v_content_metrics->'Stories'->>'plan')::int, 0);
  v_reels_plan := COALESCE((v_content_metrics->'Reels'->>'plan')::int, 0);

  -- Добавляем Post если его нет
  IF NOT v_dynamic_expenses ? 'content_Post' AND NOT v_dynamic_expenses ? 'Post' THEN
    v_dynamic_expenses := jsonb_set(
      v_dynamic_expenses,
      '{content_Post}',
      jsonb_build_object(
        'serviceName', 'Post',
        'category', 'smm',
        'count', v_post_plan,
        'rate', 800,
        'cost', v_post_plan * 800,
        'syncedAt', NOW()
      )
    );
  END IF;

  -- Добавляем Stories если его нет
  IF NOT v_dynamic_expenses ? 'content_Stories' AND NOT v_dynamic_expenses ? 'Stories' THEN
    v_dynamic_expenses := jsonb_set(
      v_dynamic_expenses,
      '{content_Stories}',
      jsonb_build_object(
        'serviceName', 'Stories',
        'category', 'smm',
        'count', v_stories_plan,
        'rate', 500,
        'cost', v_stories_plan * 500,
        'syncedAt', NOW()
      )
    );
  END IF;

  -- Добавляем Reels если его нет
  IF NOT v_dynamic_expenses ? 'content_Reels' AND NOT v_dynamic_expenses ? 'Reels' THEN
    v_dynamic_expenses := jsonb_set(
      v_dynamic_expenses,
      '{content_Reels}',
      jsonb_build_object(
        'serviceName', 'Reels',
        'category', 'smm',
        'count', v_reels_plan,
        'rate', 800,
        'cost', v_reels_plan * 800,
        'syncedAt', NOW()
      )
    );
  END IF;

  -- Обновляем расходы
  UPDATE project_expenses
  SET 
    dynamic_expenses = v_dynamic_expenses,
    last_synced_at = NOW()
  WHERE id = v_expense_id;
END;
$$;