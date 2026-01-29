/*
  # Автоматический доступ CEO ко всем модулям

  1. Описание изменений
    - Создание триггера для автоматического предоставления CEO доступа ко всем модулям
    - Обновление существующих CEO пользователей - добавление им всех модулей

  2. Безопасность
    - Триггер работает только для пользователей с job_title 'CEO'
    - Не влияет на других пользователей
*/

-- Функция для автоматического предоставления всех модулей CEO
CREATE OR REPLACE FUNCTION grant_ceo_all_modules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  all_module_slugs text[];
BEGIN
  -- Проверяем, является ли пользователь CEO
  IF NEW.job_title = 'CEO' THEN
    -- Получаем все активные модули
    SELECT ARRAY_AGG(slug) INTO all_module_slugs
    FROM platform_modules
    WHERE is_active = true;
    
    -- Устанавливаем все модули для CEO
    NEW.allowed_modules = all_module_slugs;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Создаем триггер для новых и обновленных пользователей
DROP TRIGGER IF EXISTS trigger_grant_ceo_all_modules ON users;

CREATE TRIGGER trigger_grant_ceo_all_modules
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION grant_ceo_all_modules();

-- Обновляем существующих CEO пользователей
DO $$
DECLARE
  all_module_slugs text[];
BEGIN
  -- Получаем все активные модули
  SELECT ARRAY_AGG(slug) INTO all_module_slugs
  FROM platform_modules
  WHERE is_active = true;
  
  -- Обновляем всех CEO
  UPDATE users
  SET allowed_modules = all_module_slugs
  WHERE job_title = 'CEO';
END $$;