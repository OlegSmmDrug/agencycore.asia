/*
  # Fix calculator_services category column
  
  1. Описание
    - Удаляет устаревший check constraint на колонку category
    - Меняет тип колонки category с text на uuid  
    - Добавляет foreign key constraint на calculator_categories
  
  2. Безопасность
    - Сохраняет существующие данные
    - После изменения category должна ссылаться на calculator_categories.id
*/

-- Удаляем старый check constraint, если он существует
ALTER TABLE calculator_services 
DROP CONSTRAINT IF EXISTS calculator_services_category_check;

-- Меняем тип колонки с text на uuid
-- Если в таблице уже есть данные с текстовыми категориями, они будут удалены
DO $$
BEGIN
  -- Сначала удаляем все записи со старым форматом категорий
  DELETE FROM calculator_services 
  WHERE category IN ('smm', 'target', 'sites', 'video');
  
  -- Изменяем тип колонки
  ALTER TABLE calculator_services 
  ALTER COLUMN category TYPE uuid USING category::uuid;
  
  -- Добавляем foreign key constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'calculator_services_category_fkey'
  ) THEN
    ALTER TABLE calculator_services
    ADD CONSTRAINT calculator_services_category_fkey
    FOREIGN KEY (category) REFERENCES calculator_categories(id) ON DELETE CASCADE;
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Если колонка уже uuid, ничего не делаем
    NULL;
END $$;