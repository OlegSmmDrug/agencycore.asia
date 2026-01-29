/*
  # Create Modules and Access System

  1. New Tables
    - `platform_modules` - Справочник всех модулей платформы
      - `id` (uuid, primary key)
      - `slug` (text) - Уникальный идентификатор модуля
      - `name` (text) - Название модуля
      - `description` (text) - Описание модуля
      - `icon` (text) - Иконка для отображения
      - `price` (numeric) - Цена за отдельную покупку модуля ($5)
      - `sort_order` (integer) - Порядок сортировки
      - `is_active` (boolean) - Активен ли модуль

    - `organization_modules` - Доступ организаций к модулям
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key)
      - `module_slug` (text) - Slug модуля
      - `is_unlocked` (boolean) - Разблокирован ли модуль
      - `unlocked_at` (timestamptz) - Когда разблокирован
      - `unlocked_by` (uuid) - Кто разблокировал

  2. Security
    - Enable RLS on both tables
    - Add policies for organization members

  3. Initial Data
    - Seed with default platform modules
*/

-- Create platform_modules table
CREATE TABLE IF NOT EXISTS platform_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  icon text DEFAULT 'Box',
  price numeric DEFAULT 5,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create organization_modules table
CREATE TABLE IF NOT EXISTS organization_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_slug text NOT NULL,
  is_unlocked boolean DEFAULT false,
  unlocked_at timestamptz,
  unlocked_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, module_slug)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_organization_modules_org_id ON organization_modules(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_modules_slug ON organization_modules(module_slug);

-- Enable RLS
ALTER TABLE platform_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_modules ENABLE ROW LEVEL SECURITY;

-- RLS policies for platform_modules (public read)
CREATE POLICY "Anyone can read active modules"
  ON platform_modules FOR SELECT
  USING (is_active = true);

-- RLS policies for organization_modules
CREATE POLICY "Users can read own organization modules"
  ON organization_modules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.organization_id = organization_modules.organization_id
    )
  );

-- Seed platform modules
INSERT INTO platform_modules (slug, name, description, icon, price, sort_order) VALUES
  ('projects', 'Управление проектами', 'Создание и управление проектами, таски, канбан', 'FolderKanban', 5, 1),
  ('clients', 'CRM и клиенты', 'База клиентов, воронка продаж, история взаимодействий', 'Users', 5, 2),
  ('whatsapp', 'WhatsApp интеграция', 'Чаты WhatsApp, автоответчик, шаблоны сообщений', 'MessageCircle', 5, 3),
  ('contracts', 'Договоры и документы', 'Генерация договоров, шаблоны, электронная подпись', 'FileText', 5, 4),
  ('finances', 'Финансы и бухгалтерия', 'P&L, транзакции, расходы, аналитика', 'DollarSign', 5, 5),
  ('payroll', 'Зарплаты и премии', 'Расчет ЗП, схемы оплаты, бонусы', 'Wallet', 5, 6),
  ('analytics', 'Аналитика и отчеты', 'Дашборды, KPI, метрики, экспорт', 'BarChart3', 5, 7),
  ('ads', 'Рекламные кабинеты', 'Google Ads, Facebook Ads, TikTok Ads', 'TrendingUp', 5, 8),
  ('content', 'Контент-планирование', 'Календарь контента, медиагалерея, публикации', 'Calendar', 5, 9),
  ('ai_agents', 'AI Агенты', 'Автоматизация с помощью AI, чат-боты', 'Bot', 5, 10),
  ('knowledge_base', 'База знаний', 'Документация, инструкции, FAQ', 'BookOpen', 5, 11),
  ('team', 'Управление командой', 'Пользователи, роли, права доступа', 'Users', 5, 12)
ON CONFLICT (slug) DO NOTHING;

-- Function to get module access for organization
CREATE OR REPLACE FUNCTION get_organization_module_access(org_id uuid, plan text)
RETURNS TABLE (
  module_slug text,
  module_name text,
  module_description text,
  module_icon text,
  is_available boolean,
  is_unlocked boolean,
  requires_unlock boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.slug,
    pm.name,
    pm.description,
    pm.icon,
    CASE 
      WHEN plan = 'Professional' OR plan = 'Enterprise' THEN true
      WHEN om.is_unlocked = true THEN true
      ELSE false
    END as is_available,
    COALESCE(om.is_unlocked, false) as is_unlocked,
    CASE 
      WHEN plan = 'Professional' OR plan = 'Enterprise' THEN false
      ELSE true
    END as requires_unlock
  FROM platform_modules pm
  LEFT JOIN organization_modules om ON pm.slug = om.module_slug AND om.organization_id = org_id
  WHERE pm.is_active = true
  ORDER BY pm.sort_order;
END;
$$;