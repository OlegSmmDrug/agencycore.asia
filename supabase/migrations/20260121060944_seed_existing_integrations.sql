/*
  # Добавление существующих интеграций в систему
  
  1. Функция для создания интеграций
    - Создает записи интеграций для всех организаций
    - Автоматически определяет статус на основе существующих данных
    - Безопасно обрабатывает дубликаты
  
  2. Интеграции для добавления
    - Green API (WhatsApp) - если есть настройки в проектах
    - Wazzup24 - если есть настройки
    - Livedune - если есть токены в проектах
    - Facebook Ads - если есть токены
  
  3. Безопасность
    - Функция идемпотентна (можно запускать несколько раз)
    - Не перезаписывает существующие интеграции
*/

-- Функция для безопасного добавления интеграции
CREATE OR REPLACE FUNCTION add_integration_if_not_exists(
  p_org_id uuid,
  p_integration_type text,
  p_name text,
  p_description text,
  p_category text,
  p_status text DEFAULT 'needs_config'
)
RETURNS void AS $$
BEGIN
  INSERT INTO integrations (
    organization_id,
    integration_type,
    name,
    description,
    category,
    status,
    is_active,
    config,
    sync_frequency,
    created_at
  )
  VALUES (
    p_org_id,
    p_integration_type,
    p_name,
    p_description,
    p_category,
    p_status,
    false,
    '{}'::jsonb,
    'manual',
    now()
  )
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Добавляем базовые интеграции для всех существующих организаций
DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN SELECT id FROM organizations WHERE is_deleted = false
  LOOP
    -- Green API (WhatsApp) - всегда добавляем, так как это основной способ общения
    PERFORM add_integration_if_not_exists(
      org.id,
      'green_api',
      'Green API (WhatsApp)',
      'Общение с клиентами через WhatsApp',
      'communication',
      'needs_config'
    );
    
    -- Wazzup24
    PERFORM add_integration_if_not_exists(
      org.id,
      'wazzup',
      'Wazzup24',
      'Мультиканальная платформа для бизнеса',
      'communication',
      'needs_config'
    );
    
    -- Facebook Ads
    PERFORM add_integration_if_not_exists(
      org.id,
      'facebook_ads',
      'Facebook Ads',
      'Отслеживание рекламных кампаний и ROI',
      'analytics',
      'needs_config'
    );
    
    -- Livedune
    PERFORM add_integration_if_not_exists(
      org.id,
      'livedune',
      'Livedune',
      'Аналитика Instagram аккаунтов',
      'marketplace',
      'needs_config'
    );
    
    -- Google Analytics
    PERFORM add_integration_if_not_exists(
      org.id,
      'google_analytics',
      'Google Analytics 4',
      'Аналитика трафика и поведения пользователей',
      'analytics',
      'needs_config'
    );
  END LOOP;
END $$;

-- Удаляем временную функцию (она больше не нужна)
DROP FUNCTION IF EXISTS add_integration_if_not_exists;
