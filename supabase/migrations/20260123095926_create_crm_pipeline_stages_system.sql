/*
  # CRM Pipeline Stages Management System

  1. New Tables
    - `crm_pipeline_stages`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key)
      - `status_key` (text) - ключ статуса из ClientStatus enum
      - `label` (text) - отображаемое название этапа
      - `hint` (text) - подсказка для пользователя
      - `level` (integer) - уровень прогресса (0-3)
      - `color` (text) - CSS класс для цвета
      - `sort_order` (integer) - порядок отображения
      - `is_active` (boolean) - активен ли этап
      - `is_system` (boolean) - системный этап (нельзя удалить)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - RLS отключен для упрощенной работы
    - Доступ через organization_id

  3. Initial Data
    - Заполняем стандартными этапами (без "Успешно реализовано")
*/

CREATE TABLE IF NOT EXISTS crm_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  status_key text NOT NULL,
  label text NOT NULL,
  hint text,
  level integer DEFAULT 0,
  color text DEFAULT 'border-t-4 border-slate-300',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_stages_org ON crm_pipeline_stages(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_stages_active ON crm_pipeline_stages(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_crm_stages_sort ON crm_pipeline_stages(organization_id, sort_order);

-- Функция для заполнения стандартными этапами при создании организации
CREATE OR REPLACE FUNCTION create_default_crm_stages_for_org(org_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO crm_pipeline_stages (organization_id, status_key, label, hint, level, color, sort_order, is_active, is_system) VALUES
    (org_id, 'New Lead', 'Новый лид', 'Заполните контактные данные клиента', 0, 'border-t-4 border-slate-300', 1, true, true),
    (org_id, 'Contact Established', 'Установлен контакт', 'Назначьте встречу или презентацию', 1, 'border-t-4 border-blue-400', 2, true, true),
    (org_id, 'Presentation', 'Презентация / КП', 'Отлично! Смета готова. Сформируйте КП на основе калькулятора.', 1, 'border-t-4 border-indigo-400', 3, true, true),
    (org_id, 'Contract Signing', 'Подписание договора', 'Заполните юридические реквизиты для договора', 2, 'border-t-4 border-purple-400', 4, true, true),
    (org_id, 'In Work', 'В работе', 'Проект активен. Отслеживайте задачи и финансы.', 3, 'border-t-4 border-teal-500', 5, true, true),
    (org_id, 'Lost', 'Отказ / Закрыто', 'Сделка закрыта без результата', 0, 'border-t-4 border-red-400', 6, true, true);
END;
$$;

-- Заполняем этапы для всех существующих организаций
DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN SELECT id FROM organizations LOOP
    PERFORM create_default_crm_stages_for_org(org.id);
  END LOOP;
END $$;
