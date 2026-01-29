/*
  # Интеграция калькулятора услуг с задачами и KPI

  ## Краткое описание
  Эта миграция связывает услуги из калькулятора с типами задач и системой KPI,
  позволяя динамически управлять типами задач через калькулятор услуг.

  ## Изменения

  ### 1. Расширение таблицы `tasks`
    - Добавлено поле `service_id` (text, nullable) - связь с услугой из calculator_services
    - Добавлено поле `is_deprecated` (boolean, default false) - отметка устаревших типов
    - Создан индекс для быстрого поиска задач по service_id

  ### 2. Расширение таблицы `calculator_services`
    - Добавлено поле `is_deprecated` (boolean, default false) - помечает удаленные услуги
    - Услуги теперь не удаляются физически, а помечаются как устаревшие

  ## Логика работы
    
  - Служебные типы задач (Meeting, Task, Call, Shooting) не связаны с калькулятором (service_id = NULL)
  - Контентные типы (Post, Reels, Stories + все из калькулятора) связаны через service_id
  - При "удалении" услуги из калькулятора она помечается is_deprecated = true
  - Задачи с устаревшими услугами продолжают работать до закрытия
  - В схеме ЗП отображаются только активные услуги (is_deprecated = false)

  ## Безопасность
    - Все изменения применяются с проверкой существования полей (IF NOT EXISTS)
    - Индексы создаются для оптимизации запросов
    - RLS политики не затронуты и работают как прежде
*/

-- 1. Добавляем поле service_id в таблицу tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'service_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN service_id text;
  END IF;
END $$;

-- 2. Добавляем поле is_deprecated в таблицу tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'is_deprecated'
  ) THEN
    ALTER TABLE tasks ADD COLUMN is_deprecated boolean DEFAULT false;
  END IF;
END $$;

-- 3. Добавляем поле is_deprecated в таблицу calculator_services
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calculator_services' AND column_name = 'is_deprecated'
  ) THEN
    ALTER TABLE calculator_services ADD COLUMN is_deprecated boolean DEFAULT false;
  END IF;
END $$;

-- 4. Создаем индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_tasks_service_id ON tasks(service_id) WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_is_deprecated ON tasks(is_deprecated) WHERE is_deprecated = true;
CREATE INDEX IF NOT EXISTS idx_calculator_services_is_deprecated ON calculator_services(is_deprecated);
CREATE INDEX IF NOT EXISTS idx_calculator_services_category_active ON calculator_services(category, is_active, is_deprecated);

-- 5. Создаем функцию для автоматической пометки задач при устаревании услуги
CREATE OR REPLACE FUNCTION mark_tasks_as_deprecated_on_service_deprecation()
RETURNS TRIGGER AS $$
BEGIN
  -- Если услугу помечают как устаревшую
  IF NEW.is_deprecated = true AND OLD.is_deprecated = false THEN
    -- Помечаем все незавершенные задачи связанные с этой услугой
    UPDATE tasks
    SET is_deprecated = true
    WHERE service_id = NEW.id
      AND status NOT IN ('Done', 'Archived');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Создаем триггер для автоматической пометки задач
DROP TRIGGER IF EXISTS trigger_mark_tasks_deprecated ON calculator_services;
CREATE TRIGGER trigger_mark_tasks_deprecated
  AFTER UPDATE ON calculator_services
  FOR EACH ROW
  WHEN (NEW.is_deprecated = true AND OLD.is_deprecated = false)
  EXECUTE FUNCTION mark_tasks_as_deprecated_on_service_deprecation();

-- 7. Комментарии для документации
COMMENT ON COLUMN tasks.service_id IS 'Связь с услугой из калькулятора. NULL для служебных типов (Meeting, Task, Call, Shooting)';
COMMENT ON COLUMN tasks.is_deprecated IS 'Отметка устаревших типов задач при удалении услуги из калькулятора';
COMMENT ON COLUMN calculator_services.is_deprecated IS 'Помечает удаленные услуги вместо физического удаления для сохранения истории';
