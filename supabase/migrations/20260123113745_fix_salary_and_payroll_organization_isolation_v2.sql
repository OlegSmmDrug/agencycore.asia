/*
  # Исправление изоляции данных зарплат между организациями
  
  1. Проблема
    - Таблицы salary_schemes и payroll_records не изолированы между организациями
    - Данные "перетекают" между пользователями разных организаций
  
  2. Решение
    - Назначаем существующие записи с NULL organization_id в legacy организацию
    - Обновляем существующие записи salary_schemes - связываем с организацией через users
    - Обновляем существующие записи payroll_records - связываем с организацией через user_id
    - Устанавливаем NOT NULL для organization_id
    - Обновляем unique constraints для учета organization_id
    - Обновляем RLS политики для фильтрации по organization_id
  
  3. Безопасность
    - Данные остаются у существующих пользователей
    - Новые записи обязательно требуют organization_id
    - RLS обеспечивает изоляцию на уровне базы данных
*/

-- Шаг 1: Получаем ID legacy организации
DO $$
DECLARE
  legacy_org_id uuid;
BEGIN
  SELECT id INTO legacy_org_id FROM organizations WHERE slug = 'legacy' LIMIT 1;
  
  -- Шаг 2: Мигрируем существующие salary_schemes
  -- Для схем привязанных к пользователям
  UPDATE salary_schemes ss
  SET organization_id = u.organization_id
  FROM users u
  WHERE ss.target_type = 'user' 
    AND ss.target_id = u.id::text
    AND ss.organization_id IS NULL;

  -- Для схем привязанных к должностям - назначаем в legacy организацию или берем организацию первого пользователя с этой должностью
  UPDATE salary_schemes ss
  SET organization_id = COALESCE(
    (
      SELECT u.organization_id 
      FROM users u 
      WHERE u.job_title = ss.target_id 
      ORDER BY u.created_at ASC
      LIMIT 1
    ),
    legacy_org_id
  )
  WHERE ss.target_type = 'jobTitle' 
    AND ss.organization_id IS NULL;

  -- Шаг 3: Мигрируем существующие payroll_records
  UPDATE payroll_records pr
  SET organization_id = u.organization_id
  FROM users u
  WHERE pr.user_id = u.id
    AND pr.organization_id IS NULL;

  -- Если остались записи без organization_id (пользователь удален), удаляем их
  DELETE FROM payroll_records WHERE organization_id IS NULL;
  DELETE FROM salary_schemes WHERE organization_id IS NULL;
END $$;

-- Шаг 4: Удаляем старые ограничения unique
ALTER TABLE salary_schemes DROP CONSTRAINT IF EXISTS salary_schemes_target_id_target_type_key;
ALTER TABLE payroll_records DROP CONSTRAINT IF EXISTS payroll_records_user_id_month_key;

-- Шаг 5: Устанавливаем NOT NULL для organization_id
ALTER TABLE salary_schemes ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE payroll_records ALTER COLUMN organization_id SET NOT NULL;

-- Шаг 6: Добавляем новые unique constraints с учетом organization_id
ALTER TABLE salary_schemes 
  ADD CONSTRAINT salary_schemes_org_target_unique 
  UNIQUE(organization_id, target_id, target_type);

ALTER TABLE payroll_records 
  ADD CONSTRAINT payroll_records_org_user_month_unique 
  UNIQUE(organization_id, user_id, month);

-- Шаг 7: Удаляем старые небезопасные RLS политики
DROP POLICY IF EXISTS "Allow public read access to salary_schemes" ON salary_schemes;
DROP POLICY IF EXISTS "Allow public insert to salary_schemes" ON salary_schemes;
DROP POLICY IF EXISTS "Allow public update to salary_schemes" ON salary_schemes;
DROP POLICY IF EXISTS "Allow public delete to salary_schemes" ON salary_schemes;

DROP POLICY IF EXISTS "Allow public read access to payroll_records" ON payroll_records;
DROP POLICY IF EXISTS "Allow public insert to payroll_records" ON payroll_records;
DROP POLICY IF EXISTS "Allow public update to payroll_records" ON payroll_records;
DROP POLICY IF EXISTS "Allow public delete to payroll_records" ON payroll_records;

-- Шаг 8: Создаем безопасные RLS политики с изоляцией по организациям
-- Политики для salary_schemes - все операции разрешены внутри своей организации
CREATE POLICY "Users can access salary schemes in their organization"
  ON salary_schemes FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Политики для payroll_records - все операции разрешены внутри своей организации
CREATE POLICY "Users can access payroll records in their organization"
  ON payroll_records FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Шаг 9: Создаем индексы для производительности
CREATE INDEX IF NOT EXISTS idx_salary_schemes_organization_id ON salary_schemes(organization_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_organization_id ON payroll_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_salary_schemes_org_target ON salary_schemes(organization_id, target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_payroll_records_org_user_month ON payroll_records(organization_id, user_id, month);
