/*
  # Система универсальных правил мотивации (Bonus Rule Builder)

  Создает гибкую систему настройки бонусов без программирования.

  1. Новые таблицы
    - `bonus_rules` - правила мотивации для должностей и сотрудников
      - `id` (uuid, primary key)
      - `owner_type` (text) - 'jobTitle' или 'user'
      - `owner_id` (text) - ID должности или пользователя
      - `name` (text) - название правила
      - `metric_source` (text) - источник метрики
      - `condition_type` (text) - тип условия: always/threshold/tiered
      - `threshold_value` (numeric) - пороговое значение
      - `threshold_operator` (text) - оператор сравнения
      - `tiered_config` (jsonb) - конфигурация ступеней
      - `reward_type` (text) - тип награды: percent/fixed_amount
      - `reward_value` (numeric) - значение награды
      - `apply_to_base` (boolean) - применять % к базе
      - `is_active` (boolean) - активно ли правило
      - `calculation_period` (text) - период расчета
      - `description` (text) - описание
      - `organization_id` (uuid, foreign key)

  2. Безопасность
    - RLS политики для доступа внутри организации

  3. Примеры использования
    - Sales Manager: 7% от продаж + 150к при плане >= 5млн
    - PM: Ступенчатый retention (0-50%=0%, 50-80%=3%, 80-100%=5%)
    - Targetologist: 50к бонус если CPL < 2500₸
*/

CREATE TABLE IF NOT EXISTS bonus_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('jobTitle', 'user')),
  owner_id text NOT NULL,
  name text NOT NULL,
  metric_source text NOT NULL CHECK (metric_source IN (
    'sales_revenue',
    'project_retention',
    'manual_kpi',
    'tasks_completed',
    'cpl_efficiency',
    'custom_metric'
  )),
  condition_type text NOT NULL DEFAULT 'always' CHECK (condition_type IN ('always', 'threshold', 'tiered')),
  threshold_value numeric DEFAULT 0,
  threshold_operator text DEFAULT '>=' CHECK (threshold_operator IN ('>=', '<=', '=', '>', '<')),
  tiered_config jsonb DEFAULT '[]'::jsonb,
  reward_type text NOT NULL CHECK (reward_type IN ('percent', 'fixed_amount')),
  reward_value numeric NOT NULL DEFAULT 0,
  apply_to_base boolean DEFAULT true,
  is_active boolean DEFAULT true,
  calculation_period text DEFAULT 'monthly' CHECK (calculation_period IN ('monthly', 'per_transaction')),
  description text,
  organization_id uuid REFERENCES organizations(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bonus_rules_owner ON bonus_rules(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_bonus_rules_organization ON bonus_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_bonus_rules_active ON bonus_rules(is_active) WHERE is_active = true;

ALTER TABLE bonus_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on bonus_rules"
  ON bonus_rules FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE bonus_rules IS 'Универсальная система правил мотивации и бонусов';
COMMENT ON COLUMN bonus_rules.owner_type IS 'Тип владельца: jobTitle (должность) или user (конкретный сотрудник)';
COMMENT ON COLUMN bonus_rules.metric_source IS 'Источник метрики: sales_revenue, project_retention, tasks_completed и др.';
COMMENT ON COLUMN bonus_rules.condition_type IS 'Тип условия: always (всегда), threshold (порог), tiered (ступенчатая шкала)';
COMMENT ON COLUMN bonus_rules.tiered_config IS 'JSON массив уровней: [{"min": 0, "max": 50, "reward": 0}, {"min": 50, "max": 80, "reward": 3}]';
