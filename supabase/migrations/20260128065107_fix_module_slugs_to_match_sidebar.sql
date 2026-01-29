/*
  # Исправление модулей для соответствия Sidebar

  1. Описание изменений
    - Удаляем все существующие модули
    - Создаем только те модули которые есть в Sidebar
    - Исправляем ID модулей: knowledge_base → knowledge, ai_agents → ai-agents
    - Удаляем дублирующиеся и неиспользуемые модули

  2. Список модулей в Sidebar
    - dashboard, calculator, analytics, crm, projects, tasks, notes, 
      knowledge, contracts, team, integrations, ai-agents, whatsapp, settings

  3. Безопасность
    - Сначала очищаем allowed_modules у всех пользователей
    - Удаляем старые модули
    - Создаем новые с правильными slug
    - Обновляем CEO пользователей
*/

-- Очищаем allowed_modules у всех пользователей
UPDATE users SET allowed_modules = ARRAY[]::text[];

-- Удаляем все существующие модули
DELETE FROM platform_modules;

-- Создаем только те модули которые есть в Sidebar с правильными ID
INSERT INTO platform_modules (slug, name, description, icon, price, sort_order) VALUES
  ('dashboard', 'Дашборд', 'Главная панель с ключевыми метриками', 'LayoutDashboard', 0, 1),
  ('calculator', 'Калькулятор', 'Расчет стоимости услуг для клиентов', 'Calculator', 5, 2),
  ('analytics', 'Аналитика', 'Дашборды, KPI, метрики, экспорт', 'BarChart3', 5, 3),
  ('crm', 'CRM', 'База клиентов, воронка продаж, история взаимодействий', 'Users', 5, 4),
  ('projects', 'Проекты', 'Создание и управление проектами, таски, канбан', 'FolderKanban', 5, 5),
  ('tasks', 'Задачи', 'Управление задачами, канбан, календарь', 'CheckSquare', 5, 6),
  ('notes', 'Заметки', 'Личные и командные заметки', 'StickyNote', 5, 7),
  ('knowledge', 'База знаний', 'Документация, инструкции, FAQ', 'BookOpen', 5, 8),
  ('contracts', 'Договоры', 'Генерация договоров, шаблоны, электронная подпись', 'FileText', 5, 9),
  ('team', 'Команда', 'Пользователи, роли, права доступа', 'Users', 5, 10),
  ('integrations', 'Интеграции', 'Подключение внешних сервисов', 'Plug', 5, 11),
  ('ai-agents', 'ИИ-Агенты', 'Автоматизация с помощью AI, чат-боты', 'Bot', 5, 12),
  ('whatsapp', 'WhatsApp', 'Чаты WhatsApp, автоответчик, шаблоны сообщений', 'MessageCircle', 5, 13),
  ('settings', 'Настройки', 'Настройки профиля и системы', 'Settings', 0, 14);

-- Обновляем всех CEO, добавляя им все модули
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