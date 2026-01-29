/*
  # Добавление поля services и расширение полей для договоров

  1. Изменения
    - Добавлено поле `services` (text[]) в таблицу `clients` для хранения множественных услуг
    - Добавлено поле `calculator_data` (jsonb) для хранения данных калькулятора
    - Добавлено поле `contract_file_url` (text) для хранения ссылки на файл договора
    - Добавлено поле `contract_generated_at` (timestamptz) для отметки времени генерации
  
  2. Безопасность
    - Использован `IF NOT EXISTS` для предотвращения ошибок при повторном запуске
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'services'
  ) THEN
    ALTER TABLE clients ADD COLUMN services text[] DEFAULT ARRAY[]::text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'calculator_data'
  ) THEN
    ALTER TABLE clients ADD COLUMN calculator_data jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'contract_file_url'
  ) THEN
    ALTER TABLE clients ADD COLUMN contract_file_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'contract_generated_at'
  ) THEN
    ALTER TABLE clients ADD COLUMN contract_generated_at timestamptz;
  END IF;
END $$;