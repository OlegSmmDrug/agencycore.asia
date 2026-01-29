/*
  # Добавление полей для динамических расходов

  ## Описание изменений
  Расширяем таблицу `project_expenses` для поддержки динамических расходов
  с привязкой к услугам из калькулятора и автоматической синхронизацией.

  ## Новые поля в project_expenses

  ### Динамические расходы
    - `dynamic_expenses` (jsonb) - структура { [serviceId]: { serviceName, count, rate, cost, category, syncedAt } }
    - `last_synced_at` (timestamp) - время последней синхронизации
    - `sync_source` (text) - источник данных: 'auto', 'manual', 'mixed'
  
  ### Расчет зарплат
    - `salary_calculations` (jsonb) - детали расчета окладов { [userId]: { userName, jobTitle, baseSalary, activeProjectsCount, shareForThisProject, calculatedAt } }
  
  ## Важно
  - Legacy-поля (smm_posts_count, pm_expenses и др.) сохраняются для обратной совместимости
  - Исторические данные не затрагиваются
  - Новые поля опциональны и заполняются постепенно
*/

-- Добавляем поле для динамических расходов из калькулятора
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_expenses' AND column_name = 'dynamic_expenses'
  ) THEN
    ALTER TABLE project_expenses 
    ADD COLUMN dynamic_expenses jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Добавляем поле для времени последней синхронизации
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_expenses' AND column_name = 'last_synced_at'
  ) THEN
    ALTER TABLE project_expenses 
    ADD COLUMN last_synced_at timestamptz;
  END IF;
END $$;

-- Добавляем поле для источника синхронизации
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_expenses' AND column_name = 'sync_source'
  ) THEN
    ALTER TABLE project_expenses 
    ADD COLUMN sync_source text DEFAULT 'manual' CHECK (sync_source IN ('auto', 'manual', 'mixed'));
  END IF;
END $$;

-- Добавляем поле для расчетов зарплат команды
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_expenses' AND column_name = 'salary_calculations'
  ) THEN
    ALTER TABLE project_expenses 
    ADD COLUMN salary_calculations jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Создаем индекс для быстрого поиска по дате синхронизации
CREATE INDEX IF NOT EXISTS idx_project_expenses_last_synced 
ON project_expenses(last_synced_at DESC);

-- Добавляем комментарии для документации
COMMENT ON COLUMN project_expenses.dynamic_expenses IS 'Динамические расходы из калькулятора: { [serviceId]: { serviceName, count, rate, cost, category, syncedAt } }';
COMMENT ON COLUMN project_expenses.last_synced_at IS 'Время последней автоматической синхронизации с контентом';
COMMENT ON COLUMN project_expenses.sync_source IS 'Источник данных: auto - автосинхронизация, manual - ручной ввод, mixed - комбинированный';
COMMENT ON COLUMN project_expenses.salary_calculations IS 'Детали расчета окладов: { [userId]: { userName, jobTitle, baseSalary, activeProjectsCount, shareForThisProject, calculatedAt } }';
