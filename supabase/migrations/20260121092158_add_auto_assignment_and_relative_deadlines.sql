/*
  # Добавление автоназначения и относительных дедлайнов в шаблоны

  ## Изменения

  1. Обновление таблицы roadmap_template_tasks
    - Добавлена колонка `job_title_required` для хранения требуемой должности
    - Обновлено `estimated_hours` с поддержкой дробных значений
    - Добавлен индекс для быстрого поиска задач по должностям

  2. Обновление таблицы tasks
    - Убедиться что `duration_days` существует для относительных дедлайнов
    - Добавлена колонка `auto_assigned` для отслеживания автоматического назначения

  3. Новые функции
    - Функция для расчета дедлайнов при запуске этапа
    - Функция для автоназначения по должностям

  ## Примечания
  - Автоназначение происходит при применении шаблона к проекту
  - Дедлайны рассчитываются динамически при запуске этапа Level2
  - Должности из константы INITIAL_JOB_TITLES
*/

-- Добавление колонки job_title_required в roadmap_template_tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roadmap_template_tasks' AND column_name = 'job_title_required'
  ) THEN
    ALTER TABLE roadmap_template_tasks ADD COLUMN job_title_required text;
    CREATE INDEX IF NOT EXISTS idx_template_tasks_job_title ON roadmap_template_tasks(job_title_required);
  END IF;
END $$;

-- Добавление колонки auto_assigned в tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'auto_assigned'
  ) THEN
    ALTER TABLE tasks ADD COLUMN auto_assigned boolean DEFAULT false;
  END IF;
END $$;

-- Обновление estimated_hours для поддержки дробных значений (уже numeric, проверяем)
DO $$
BEGIN
  -- Убедимся что estimated_hours поддерживает дробные значения
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roadmap_template_tasks' 
    AND column_name = 'estimated_hours'
    AND data_type = 'integer'
  ) THEN
    ALTER TABLE roadmap_template_tasks ALTER COLUMN estimated_hours TYPE numeric USING estimated_hours::numeric;
  END IF;
END $$;

-- Создание функции для автоматического назначения задач по должностям
CREATE OR REPLACE FUNCTION auto_assign_task_by_job_title(
  p_project_id uuid,
  p_job_title text
) RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Найти первого пользователя из команды проекта с нужной должностью
  SELECT pm.user_id INTO v_user_id
  FROM project_members pm
  JOIN users u ON u.id = pm.user_id
  WHERE pm.project_id = p_project_id
    AND u.job_title = p_job_title
  ORDER BY u.name
  LIMIT 1;
  
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Создание функции для расчета дедлайнов задач этапа
CREATE OR REPLACE FUNCTION calculate_task_deadlines(
  p_stage_id uuid,
  p_start_date timestamptz
) RETURNS void AS $$
BEGIN
  -- Обновить дедлайны всех задач этапа на основе их duration_days
  UPDATE tasks
  SET deadline = p_start_date + (COALESCE(duration_days, 3) || ' days')::interval
  WHERE stage_level2_id = p_stage_id
    AND deadline IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Комментарии для документации
COMMENT ON COLUMN roadmap_template_tasks.job_title_required IS 'Требуемая должность для выполнения задачи (автоназначение)';
COMMENT ON COLUMN tasks.auto_assigned IS 'Задача была назначена автоматически по должности';
COMMENT ON FUNCTION auto_assign_task_by_job_title IS 'Находит подходящего исполнителя для задачи по должности из команды проекта';
COMMENT ON FUNCTION calculate_task_deadlines IS 'Рассчитывает дедлайны задач этапа на основе даты запуска и duration_days';
