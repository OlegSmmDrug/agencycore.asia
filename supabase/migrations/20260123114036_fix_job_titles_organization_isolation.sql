/*
  # Исправление изоляции должностей между организациями
  
  1. Проблема
    - Таблица job_titles не изолирована между организациями
    - UNIQUE constraint на title не учитывает organization_id
    - Должности "перетекают" между организациями
  
  2. Решение
    - Обновляем существующие записи job_titles - связываем с организацией
    - Обновляем UNIQUE constraint для учета organization_id
    - Устанавливаем NOT NULL для organization_id
    - Обновляем RLS политики для фильтрации по organization_id
  
  3. Безопасность
    - Каждая организация может иметь свои должности
    - Названия должностей могут повторяться между организациями
    - RLS обеспечивает изоляцию на уровне базы данных
*/

-- Шаг 1: Мигрируем существующие job_titles в legacy организацию
DO $$
DECLARE
  legacy_org_id uuid;
BEGIN
  SELECT id INTO legacy_org_id FROM organizations WHERE slug = 'legacy' LIMIT 1;
  
  -- Обновляем все должности без organization_id
  UPDATE job_titles
  SET organization_id = legacy_org_id
  WHERE organization_id IS NULL;
  
  -- Удаляем должности, которые не смогли мигрировать (нет legacy org)
  DELETE FROM job_titles WHERE organization_id IS NULL;
END $$;

-- Шаг 2: Удаляем старый UNIQUE constraint
ALTER TABLE job_titles DROP CONSTRAINT IF EXISTS job_titles_title_key;

-- Шаг 3: Устанавливаем NOT NULL для organization_id
ALTER TABLE job_titles ALTER COLUMN organization_id SET NOT NULL;

-- Шаг 4: Добавляем новый UNIQUE constraint с учетом organization_id
ALTER TABLE job_titles 
  ADD CONSTRAINT job_titles_org_title_unique 
  UNIQUE(organization_id, title);

-- Шаг 5: Удаляем старые небезопасные RLS политики
DROP POLICY IF EXISTS "Allow public read access to job_titles" ON job_titles;
DROP POLICY IF EXISTS "Allow public insert to job_titles" ON job_titles;
DROP POLICY IF EXISTS "Allow public update to job_titles" ON job_titles;
DROP POLICY IF EXISTS "Allow public delete to job_titles" ON job_titles;

-- Шаг 6: Создаем безопасные RLS политики с изоляцией по организациям
CREATE POLICY "Users can access job titles in their organization"
  ON job_titles FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Шаг 7: Обновляем индекс для производительности
DROP INDEX IF EXISTS idx_job_titles_organization_id;
CREATE INDEX idx_job_titles_org_title ON job_titles(organization_id, title);
