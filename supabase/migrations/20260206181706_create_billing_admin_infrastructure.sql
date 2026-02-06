/*
  # Billing Admin Infrastructure

  1. Modified Tables
    - `subscription_plans`
      - `price_kzt` (numeric) - Monthly price in Kazakhstani Tenge
      - `additional_user_price_usd` (numeric) - Per additional user USD price
      - `additional_user_price_kzt` (numeric) - Per additional user KZT price
      - `features_display` (jsonb) - Display features [{text, included}]
      - `is_popular` (boolean) - Highlight as popular plan
      - `display_name_ru` (text) - Russian display name
      - `description_ru` (text) - Russian description
    - `platform_modules`
      - `price_kzt` (numeric) - Module price in KZT

  2. New Tables
    - `balance_transactions` - Tracks all balance changes (admin credits, top-ups, purchases)
      - `organization_id`, `user_id`, `admin_id`, `amount`, `type`, `description`, `balance_before`, `balance_after`
    - `subscription_period_bonuses` - Configurable subscription period bonus months
      - `period_key`, `period_label`, `months`, `bonus_months`, `sort_order`, `is_active`

  3. Data Updates
    - Syncs subscription_plans with actual pricing used in the app
    - Seeds subscription period bonuses (6mo, 9mo, 1yr, 2yr)
    - Updates platform_modules KZT pricing
*/

-- 1. Add new columns to subscription_plans
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'price_kzt') THEN
    ALTER TABLE subscription_plans ADD COLUMN price_kzt numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'additional_user_price_usd') THEN
    ALTER TABLE subscription_plans ADD COLUMN additional_user_price_usd numeric DEFAULT 3;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'additional_user_price_kzt') THEN
    ALTER TABLE subscription_plans ADD COLUMN additional_user_price_kzt numeric DEFAULT 1350;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'features_display') THEN
    ALTER TABLE subscription_plans ADD COLUMN features_display jsonb DEFAULT '[]';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'is_popular') THEN
    ALTER TABLE subscription_plans ADD COLUMN is_popular boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'display_name_ru') THEN
    ALTER TABLE subscription_plans ADD COLUMN display_name_ru text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'description_ru') THEN
    ALTER TABLE subscription_plans ADD COLUMN description_ru text DEFAULT '';
  END IF;
END $$;

-- 2. Update existing plans with correct values
UPDATE subscription_plans SET
  display_name_ru = 'Бесплатный',
  description_ru = 'Для частных пользователей или стартовых команд',
  price_monthly = 0,
  price_kzt = 0,
  max_users = 2,
  max_projects = 10,
  additional_user_price_usd = 3,
  additional_user_price_kzt = 1350,
  is_popular = false,
  features_display = '[{"text":"До 2 пользователей","included":true},{"text":"10 проектов в работе","included":true},{"text":"Базовую CRM","included":true},{"text":"Модуль аналитики","included":false},{"text":"API интеграция","included":false}]'
WHERE name = 'FREE';

UPDATE subscription_plans SET
  display_name_ru = 'Стартовый',
  description_ru = 'Для растущих команд и большей совместной работы',
  price_monthly = 9,
  price_kzt = 4050,
  max_users = 10,
  max_projects = 100,
  additional_user_price_usd = 3,
  additional_user_price_kzt = 1350,
  is_popular = false,
  features_display = '[{"text":"Всё что в FREE тарифе","included":true},{"text":"3-10 пользователей","included":true},{"text":"100 проектов в работе","included":true},{"text":"Зарплатную ведомость","included":true},{"text":"API интеграция","included":false}]'
WHERE name = 'STARTER';

UPDATE subscription_plans SET
  display_name_ru = 'Профессиональный',
  description_ru = 'Для растущих команд и большей совместной работы',
  price_monthly = 25,
  price_kzt = 11250,
  max_users = 25,
  max_projects = NULL,
  additional_user_price_usd = 3,
  additional_user_price_kzt = 1350,
  is_popular = true,
  features_display = '[{"text":"Всё что в СТАРТОВОМ тарифе","included":true},{"text":"до 25 пользователей","included":true},{"text":"ERP модуль Аналитики","included":true},{"text":"Продвинутые готовые модули","included":true},{"text":"API интеграция","included":true}]'
WHERE name = 'PROFESSIONAL';

UPDATE subscription_plans SET
  display_name_ru = 'Enterprise',
  description_ru = 'Для больших команд с индивидуальными потребностями',
  price_monthly = 499,
  price_kzt = 224550,
  max_users = NULL,
  max_projects = NULL,
  additional_user_price_usd = 3,
  additional_user_price_kzt = 1350,
  is_popular = false,
  features_display = '[{"text":"Всё из Профессионального","included":true},{"text":"Неограниченное количество пользователей","included":true},{"text":"Приоритетная поддержка 24/7","included":true},{"text":"Выделенный менеджер","included":true},{"text":"Кастомная интеграция","included":true}]'
WHERE name = 'ENTERPRISE';

-- 3. Add KZT price to platform_modules
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'platform_modules' AND column_name = 'price_kzt') THEN
    ALTER TABLE platform_modules ADD COLUMN price_kzt numeric DEFAULT 2250;
  END IF;
END $$;

-- 4. Create balance_transactions table
CREATE TABLE IF NOT EXISTS balance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  admin_id uuid,
  amount numeric NOT NULL,
  type text NOT NULL DEFAULT 'credit' CHECK (type IN ('credit', 'debit', 'topup', 'plan_purchase', 'module_purchase', 'user_purchase')),
  description text DEFAULT '',
  balance_before numeric DEFAULT 0,
  balance_after numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_balance_transactions_org ON balance_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_balance_transactions_user ON balance_transactions(user_id);

-- 5. Create subscription_period_bonuses table
CREATE TABLE IF NOT EXISTS subscription_period_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_key text UNIQUE NOT NULL,
  period_label text NOT NULL,
  months integer NOT NULL,
  bonus_months integer NOT NULL DEFAULT 0,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO subscription_period_bonuses (period_key, period_label, months, bonus_months, sort_order)
VALUES
  ('6months', '6 месяцев', 6, 1, 1),
  ('9months', '9 месяцев', 9, 1, 2),
  ('1year', '1 год', 12, 2, 3),
  ('2years', '2 года', 24, 6, 4)
ON CONFLICT (period_key) DO NOTHING;