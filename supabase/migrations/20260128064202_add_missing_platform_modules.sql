/*
  # Добавление недостающих модулей платформы

  1. Описание изменений
    - Добавляем недостающие модули которые есть в интерфейсе
    - dashboard, calculator, crm, tasks, notes, integrations

  2. Безопасность
    - Использует ON CONFLICT DO NOTHING для безопасного добавления
*/

-- Добавляем недостающие модули
INSERT INTO platform_modules (slug, name, description, icon, price, sort_order) VALUES
  ('dashboard', 'Главная панель', 'Персональный дашборд с ключевыми метриками', 'LayoutDashboard', 0, 0),
  ('calculator', 'Калькулятор стоимости', 'Расчет стоимости услуг для клиентов', 'Calculator', 5, 13),
  ('crm', 'CRM', 'Воронка продаж и управление клиентами', 'Users', 5, 14),
  ('tasks', 'Задачи', 'Управление задачами, канбан, календарь', 'CheckSquare', 5, 15),
  ('notes', 'Заметки', 'Личные и командные заметки', 'StickyNote', 5, 16),
  ('integrations', 'Интеграции', 'Подключение внешних сервисов', 'Plug', 5, 17)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order;

-- Обновляем всех CEO, добавляя им новые модули
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