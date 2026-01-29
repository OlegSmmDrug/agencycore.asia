/*
  # Создание интеграции вебхука Creatium
  
  1. Добавляем интеграцию Creatium webhook для существующих организаций
  2. Создаем записи webhook_endpoints с правильными URL
  
  ## Что делает миграция
  - Создает интеграцию типа 'creatium' для legacy организации
  - Создает webhook endpoint с корректным URL и токеном
  - Другие организации смогут создавать свои вебхуки через интерфейс
*/

-- Создаем интеграцию Creatium для legacy организации (Your Agency)
DO $$
DECLARE
  legacy_org_id uuid;
  creatium_integration_id uuid;
  webhook_url text;
BEGIN
  -- Получаем ID legacy организации
  SELECT id INTO legacy_org_id FROM organizations WHERE slug = 'legacy' LIMIT 1;
  
  IF legacy_org_id IS NOT NULL THEN
    -- Создаем интеграцию Creatium, если её еще нет
    INSERT INTO integrations (
      organization_id,
      integration_type,
      name,
      description,
      category,
      status,
      is_active,
      config
    ) VALUES (
      legacy_org_id,
      'creatium',
      'Creatium Webhook',
      'Получение лидов с сайтов через Creatium',
      'crm_automation',
      'active',
      true,
      '{"webhook_type": "creatium", "auto_create_leads": true}'::jsonb
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO creatium_integration_id;
    
    -- Если интеграция уже существует, получаем её ID
    IF creatium_integration_id IS NULL THEN
      SELECT id INTO creatium_integration_id 
      FROM integrations 
      WHERE organization_id = legacy_org_id 
        AND integration_type = 'creatium' 
      LIMIT 1;
    END IF;
    
    -- Получаем URL Supabase
    webhook_url := current_setting('app.supabase_url', true);
    IF webhook_url IS NULL OR webhook_url = '' THEN
      webhook_url := 'https://your-project.supabase.co';
    END IF;
    
    -- Создаем webhook endpoint
    INSERT INTO webhook_endpoints (
      organization_id,
      name,
      description,
      endpoint_url,
      source_type,
      field_mapping,
      is_active,
      total_received
    ) VALUES (
      legacy_org_id,
      'Creatium Webhook',
      'Автоматическое создание лидов из форм на сайте',
      webhook_url || '/functions/v1/creatium-webhook?organization_id=' || legacy_org_id,
      'creatium',
      '{
        "name": ["name", "fio", "client_name"],
        "phone": ["phone", "tel", "telephone"],
        "email": ["email", "mail"],
        "description": ["message", "comment", "description"],
        "utm_source": ["utm_source"],
        "utm_medium": ["utm_medium"],
        "utm_campaign": ["utm_campaign"]
      }'::jsonb,
      true,
      0
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Created Creatium webhook integration for organization %', legacy_org_id;
  END IF;
END $$;
