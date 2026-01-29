/*
  # Добавление стандартных данных для калькулятора
  
  1. Описание
    - Создает стандартные категории и услуги калькулятора для всех организаций
    - Гарантирует, что у каждой организации есть базовый набор услуг
  
  2. Изменения
    - Добавляет категории: SMM, Видеосъемка, Фотосъемка
    - Добавляет типовые услуги для каждой категории
  
  3. Примечания
    - Данные добавляются только для организаций, у которых еще нет категорий
    - Категории и услуги можно редактировать после создания
*/

DO $$
DECLARE
  org RECORD;
  cat_smm_id text;
  cat_video_id text;
  cat_photo_id text;
BEGIN
  -- Проходим по всем организациям, у которых нет категорий калькулятора
  FOR org IN 
    SELECT o.id 
    FROM organizations o
    WHERE NOT EXISTS (
      SELECT 1 FROM calculator_categories cc 
      WHERE cc.organization_id = o.id
    )
  LOOP
    RAISE NOTICE 'Creating calculator data for organization: %', org.id;
    
    -- Генерируем ID для категорий
    cat_smm_id := 'cat_smm_' || replace(org.id::text, '-', '');
    cat_video_id := 'cat_video_' || replace(org.id::text, '-', '');
    cat_photo_id := 'cat_photo_' || replace(org.id::text, '-', '');
    
    -- Создаем категории для организации
    INSERT INTO calculator_categories (id, organization_id, name, icon, color, sort_order, is_active)
    VALUES 
      (cat_smm_id, org.id, 'SMM', '📱', '#3B82F6', 1, true),
      (cat_video_id, org.id, 'Видеосъемка', '🎬', '#EF4444', 2, true),
      (cat_photo_id, org.id, 'Фотосъемка', '📸', '#10B981', 3, true);
    
    -- Создаем услуги для категории SMM
    INSERT INTO calculator_services (id, organization_id, name, price, type, icon, category, sort_order, is_active)
    VALUES 
      ('srv_' || gen_random_uuid()::text, org.id, 'Разработка стратегии', 500, 'checkbox', '📋', cat_smm_id, 1, true),
      ('srv_' || gen_random_uuid()::text, org.id, 'Создание контента', 300, 'counter', '📝', cat_smm_id, 2, true),
      ('srv_' || gen_random_uuid()::text, org.id, 'Таргетированная реклама', 400, 'checkbox', '🎯', cat_smm_id, 3, true),
      ('srv_' || gen_random_uuid()::text, org.id, 'Аналитика и отчеты', 200, 'checkbox', '📊', cat_smm_id, 4, true);
    
    -- Создаем услуги для категории Видеосъемка
    INSERT INTO calculator_services (id, organization_id, name, price, type, icon, category, max_value, sort_order, is_active)
    VALUES 
      ('srv_' || gen_random_uuid()::text, org.id, 'Видеограф', 800, 'counter', '🎥', cat_video_id, 10, 1, true),
      ('srv_' || gen_random_uuid()::text, org.id, 'Монтаж видео', 500, 'counter', '✂️', cat_video_id, 20, 2, true),
      ('srv_' || gen_random_uuid()::text, org.id, 'Цветокоррекция', 300, 'checkbox', '🎨', cat_video_id, NULL, 3, true),
      ('srv_' || gen_random_uuid()::text, org.id, 'Анимация', 600, 'checkbox', '✨', cat_video_id, NULL, 4, true);
    
    -- Создаем услуги для категории Фотосъемка
    INSERT INTO calculator_services (id, organization_id, name, price, type, icon, category, max_value, sort_order, is_active)
    VALUES 
      ('srv_' || gen_random_uuid()::text, org.id, 'Фотограф', 600, 'counter', '📷', cat_photo_id, 10, 1, true),
      ('srv_' || gen_random_uuid()::text, org.id, 'Ретушь фото', 200, 'counter', '🖼️', cat_photo_id, 50, 2, true),
      ('srv_' || gen_random_uuid()::text, org.id, 'Фотосессия в студии', 1000, 'checkbox', '🏢', cat_photo_id, NULL, 3, true),
      ('srv_' || gen_random_uuid()::text, org.id, 'Выездная съемка', 1500, 'checkbox', '🚗', cat_photo_id, NULL, 4, true);
    
  END LOOP;
END $$;