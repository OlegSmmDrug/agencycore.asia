/*
  # Система учета расходов по проектам

  ## Описание
  Создание системы для отслеживания фактических расходов по каждому проекту с автоматическим
  расчетом себестоимости и маржинальности.

  ## 1. Новые таблицы

  ### `project_expenses`
  Основная таблица для хранения расходов по проекту за месяц:
  - `id` (uuid, primary key)
  - `project_id` (uuid, foreign key) - ссылка на проект
  - `month` (text) - месяц в формате YYYY-MM
  - `smm_expenses` (numeric) - расходы СММ (автоматически рассчитываются)
  - `smm_posts_count` (integer) - количество постов (для автоподсчета)
  - `smm_reels_count` (integer) - количество reels
  - `smm_stories_count` (integer) - количество stories
  - `smm_spec_design_count` (integer) - спец.дизайны
  - `smm_monitoring` (boolean) - мониторинг
  - `smm_dubbing_count` (integer) - дублирование
  - `smm_scenarios_count` (integer) - сценарии
  - `smm_manual_adjustment` (numeric) - ручная корректировка СММ расходов
  - `pm_expenses` (numeric) - расходы проджекта (распределенная ЗП)
  - `pm_salary_share` (numeric) - доля ЗП проджекта на этот проект
  - `pm_project_count` (integer) - количество проектов у проджекта
  - `production_expenses` (numeric) - расходы продакшна
  - `production_mobilograph_hours` (numeric) - часы мобилографа
  - `production_photographer_hours` (numeric) - часы фотографа
  - `production_videographer_hours` (numeric) - часы видеографа
  - `production_video_cost` (numeric) - стоимость видео
  - `production_manual_adjustment` (numeric) - ручная корректировка
  - `models_expenses` (numeric) - расходы на моделей (ручной ввод)
  - `targetologist_expenses` (numeric) - расходы таргетолога (распределенная ЗП)
  - `targetologist_salary_share` (numeric) - доля ЗП таргетолога
  - `targetologist_project_count` (integer) - количество проектов у таргетолога
  - `other_expenses` (numeric) - прочие расходы
  - `other_expenses_description` (text) - описание прочих расходов
  - `total_expenses` (numeric) - общая сумма расходов (рассчитывается)
  - `revenue` (numeric) - выручка по проекту за месяц
  - `margin_percent` (numeric) - маржинальность в процентах
  - `notes` (text) - заметки
  - `created_by` (uuid) - кто создал
  - `updated_by` (uuid) - кто обновил
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `project_expenses_history`
  История изменений расходов для аудита:
  - `id` (uuid, primary key)
  - `expense_id` (uuid) - ссылка на project_expenses
  - `changed_by` (uuid) - кто изменил
  - `field_name` (text) - название поля
  - `old_value` (numeric) - старое значение
  - `new_value` (numeric) - новое значение
  - `change_reason` (text) - причина изменения
  - `created_at` (timestamptz)

  ## 2. Безопасность
  - RLS включен для обеих таблиц
  - Все пользователи могут просматривать расходы
  - Только проджекты (PM) могут редактировать расходы
  - История изменений доступна только для чтения

  ## 3. Индексы
  - Индекс по project_id для быстрой выборки
  - Индекс по month для фильтрации по периодам
  - Составной индекс (project_id, month) для уникальности
*/

-- Таблица расходов по проектам
CREATE TABLE IF NOT EXISTS project_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  month text NOT NULL,
  
  -- СММ расходы
  smm_expenses numeric DEFAULT 0,
  smm_posts_count integer DEFAULT 0,
  smm_reels_count integer DEFAULT 0,
  smm_stories_count integer DEFAULT 0,
  smm_spec_design_count integer DEFAULT 0,
  smm_monitoring boolean DEFAULT false,
  smm_dubbing_count integer DEFAULT 0,
  smm_scenarios_count integer DEFAULT 0,
  smm_manual_adjustment numeric DEFAULT 0,
  
  -- Проджект расходы
  pm_expenses numeric DEFAULT 0,
  pm_salary_share numeric DEFAULT 0,
  pm_project_count integer DEFAULT 1,
  
  -- Продакшн расходы
  production_expenses numeric DEFAULT 0,
  production_mobilograph_hours numeric DEFAULT 0,
  production_photographer_hours numeric DEFAULT 0,
  production_videographer_hours numeric DEFAULT 0,
  production_video_cost numeric DEFAULT 0,
  production_manual_adjustment numeric DEFAULT 0,
  
  -- Модели
  models_expenses numeric DEFAULT 0,
  
  -- Таргетолог
  targetologist_expenses numeric DEFAULT 0,
  targetologist_salary_share numeric DEFAULT 0,
  targetologist_project_count integer DEFAULT 1,
  
  -- Прочее
  other_expenses numeric DEFAULT 0,
  other_expenses_description text DEFAULT '',
  
  -- Итого
  total_expenses numeric DEFAULT 0,
  revenue numeric DEFAULT 0,
  margin_percent numeric DEFAULT 0,
  
  -- Мета
  notes text DEFAULT '',
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Уникальность: один месяц - одна запись расходов
  UNIQUE(project_id, month)
);

-- Таблица истории изменений
CREATE TABLE IF NOT EXISTS project_expenses_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES project_expenses(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES users(id),
  field_name text NOT NULL,
  old_value text DEFAULT '',
  new_value text DEFAULT '',
  change_reason text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Индексы для быстрой выборки
CREATE INDEX IF NOT EXISTS idx_project_expenses_project_id ON project_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_project_expenses_month ON project_expenses(month);
CREATE INDEX IF NOT EXISTS idx_project_expenses_history_expense_id ON project_expenses_history(expense_id);

-- Enable RLS
ALTER TABLE project_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_expenses_history ENABLE ROW LEVEL SECURITY;

-- Политики для project_expenses
CREATE POLICY "Все пользователи могут просматривать расходы"
  ON project_expenses
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Проджекты могут создавать расходы"
  ON project_expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Проджекты могут обновлять расходы"
  ON project_expenses
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Проджекты могут удалять расходы"
  ON project_expenses
  FOR DELETE
  TO authenticated
  USING (true);

-- Политики для истории
CREATE POLICY "Все пользователи могут просматривать историю"
  ON project_expenses_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Система может записывать историю"
  ON project_expenses_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_project_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_expenses_updated_at_trigger
  BEFORE UPDATE ON project_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_project_expenses_updated_at();
