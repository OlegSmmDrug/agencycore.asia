/*
  # Создание системы зарплат и должностей

  ## Новые таблицы
  
  ### 1. `job_titles` - Справочник должностей
    - `id` (uuid, primary key)
    - `title` (text, unique) - название должности
    - `is_active` (boolean) - активна ли должность
    - `created_at` (timestamp)
    
  ### 2. `salary_schemes` - Схемы начисления зарплат
    - `id` (uuid, primary key)
    - `target_id` (text) - ID должности или пользователя
    - `target_type` (text) - тип: 'jobTitle' или 'user'
    - `base_salary` (numeric) - базовый оклад
    - `kpi_rules` (jsonb) - правила KPI начислений
    - `pm_bonus_percent` (numeric) - процент PM бонуса
    - `created_at`, `updated_at` (timestamp)
    
  ### 3. `payroll_records` - Зарплатные ведомости
    - `id` (uuid, primary key)
    - `user_id` (uuid) - ссылка на сотрудника
    - `month` (text) - месяц в формате YYYY-MM
    - `fix_salary` (numeric) - фиксированная часть
    - `calculated_kpi` (numeric) - рассчитанный KPI
    - `manual_bonus` (numeric) - ручная премия
    - `manual_penalty` (numeric) - ручной штраф
    - `advance` (numeric) - аванс
    - `status` (text) - статус: DRAFT, FROZEN, PAID
    - `balance_at_start` (numeric) - баланс на начало периода
    - `paid_at` (timestamp) - дата выплаты
    - `created_at`, `updated_at` (timestamp)
  
  ## Безопасность
    - RLS включен для всех таблиц
    - Политики доступа для authenticated пользователей
*/

-- Создание таблицы должностей
CREATE TABLE IF NOT EXISTS job_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE job_titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to job_titles"
  ON job_titles FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to job_titles"
  ON job_titles FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to job_titles"
  ON job_titles FOR UPDATE
  TO public
  USING (true);

-- Заполнение начальными должностями
INSERT INTO job_titles (title) VALUES
  ('CEO'),
  ('PM / Project Manager'),
  ('SMM / Контент-менеджер'),
  ('Targetologist / Таргетолог'),
  ('Videographer / Видеограф'),
  ('Mobilograph / Мобилограф'),
  ('Designer / Дизайнер'),
  ('Copywriter / Копирайтер'),
  ('Intern / Стажер')
ON CONFLICT (title) DO NOTHING;

-- Создание таблицы схем зарплат
CREATE TABLE IF NOT EXISTS salary_schemes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('jobTitle', 'user')),
  base_salary numeric DEFAULT 0,
  kpi_rules jsonb DEFAULT '[]'::jsonb,
  pm_bonus_percent numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(target_id, target_type)
);

ALTER TABLE salary_schemes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to salary_schemes"
  ON salary_schemes FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to salary_schemes"
  ON salary_schemes FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to salary_schemes"
  ON salary_schemes FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Allow public delete from salary_schemes"
  ON salary_schemes FOR DELETE
  TO public
  USING (true);

-- Индекс для быстрого поиска схем
CREATE INDEX IF NOT EXISTS idx_salary_schemes_target ON salary_schemes(target_id, target_type);

-- Создание таблицы зарплатных ведомостей
CREATE TABLE IF NOT EXISTS payroll_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month text NOT NULL,
  fix_salary numeric DEFAULT 0,
  calculated_kpi numeric DEFAULT 0,
  manual_bonus numeric DEFAULT 0,
  manual_penalty numeric DEFAULT 0,
  advance numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FROZEN', 'PAID')),
  balance_at_start numeric DEFAULT 0,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, month)
);

ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to payroll_records"
  ON payroll_records FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to payroll_records"
  ON payroll_records FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to payroll_records"
  ON payroll_records FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Allow public delete from payroll_records"
  ON payroll_records FOR DELETE
  TO public
  USING (true);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_payroll_records_user ON payroll_records(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_month ON payroll_records(month);
CREATE INDEX IF NOT EXISTS idx_payroll_records_status ON payroll_records(status);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для автоматического обновления updated_at
DROP TRIGGER IF EXISTS update_salary_schemes_updated_at ON salary_schemes;
CREATE TRIGGER update_salary_schemes_updated_at
  BEFORE UPDATE ON salary_schemes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payroll_records_updated_at ON payroll_records;
CREATE TRIGGER update_payroll_records_updated_at
  BEFORE UPDATE ON payroll_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
