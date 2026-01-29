/*
  # Добавление инфраструктуры супер-администратора

  ## Описание
  Создает систему супер-администраторов для управления SaaS платформой.
  Супер-админы могут видеть все организации, управлять подписками и мониторить систему.

  ## 1. Изменения в таблицах

  ### users
  - Добавляем поле `is_super_admin` (boolean) - флаг супер-администратора

  ## 2. Функции

  ### get_platform_statistics()
  - Возвращает общую статистику платформы:
    - Общий MRR (месячный регулярный доход)
    - Количество активных пользователей
    - Процент оттока (churn rate)
    - Количество новых регистраций за период

  ### get_organizations_list()
  - Возвращает список всех организаций с метриками для супер-админа

  ## 3. Безопасность
  - Только пользователи с is_super_admin = true могут вызывать функции супер-админа
*/

-- Добавляем поле is_super_admin к users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- Создаем индекс для быстрого поиска супер-админов
CREATE INDEX IF NOT EXISTS idx_users_is_super_admin ON users(is_super_admin) WHERE is_super_admin = true;

-- Функция для получения общей статистики платформы
CREATE OR REPLACE FUNCTION get_platform_statistics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  total_mrr numeric;
  active_users_count integer;
  total_organizations integer;
  active_organizations integer;
  new_orgs_last_month integer;
  churned_orgs_last_month integer;
  churn_rate numeric;
BEGIN
  -- Проверяем, что пользователь - супер-админ
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied: super admin only';
  END IF;

  -- Считаем общий MRR
  SELECT COALESCE(SUM(mrr), 0)
  INTO total_mrr
  FROM organization_subscriptions
  WHERE status IN ('active', 'trial');

  -- Считаем активных пользователей
  SELECT COUNT(DISTINCT u.id)
  INTO active_users_count
  FROM users u
  INNER JOIN organizations o ON u.organization_id = o.id
  WHERE o.is_deleted = false AND o.is_blocked = false;

  -- Считаем организации
  SELECT COUNT(*)
  INTO total_organizations
  FROM organizations
  WHERE is_deleted = false;

  SELECT COUNT(*)
  INTO active_organizations
  FROM organizations
  WHERE is_deleted = false AND is_blocked = false;

  -- Новые организации за последний месяц
  SELECT COUNT(*)
  INTO new_orgs_last_month
  FROM organizations
  WHERE created_at >= NOW() - INTERVAL '30 days'
    AND is_deleted = false;

  -- Отток за последний месяц (canceled подписки)
  SELECT COUNT(DISTINCT organization_id)
  INTO churned_orgs_last_month
  FROM organization_subscriptions
  WHERE canceled_at >= NOW() - INTERVAL '30 days';

  -- Рассчитываем churn rate
  IF active_organizations > 0 THEN
    churn_rate := (churned_orgs_last_month::numeric / active_organizations::numeric) * 100;
  ELSE
    churn_rate := 0;
  END IF;

  result := jsonb_build_object(
    'total_mrr', total_mrr,
    'active_users', active_users_count,
    'total_organizations', total_organizations,
    'active_organizations', active_organizations,
    'new_organizations_last_month', new_orgs_last_month,
    'churned_organizations_last_month', churned_orgs_last_month,
    'churn_rate', ROUND(churn_rate, 2)
  );

  RETURN result;
END;
$$;

-- Функция для получения списка всех организаций (для супер-админа)
CREATE OR REPLACE FUNCTION get_organizations_list(
  search_query text DEFAULT NULL,
  limit_count integer DEFAULT 50,
  offset_count integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  owner_email text,
  plan_name text,
  subscription_status text,
  mrr numeric,
  users_count integer,
  projects_count integer,
  is_blocked boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Проверяем, что пользователь - супер-админ
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied: super admin only';
  END IF;

  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.slug,
    owner.email as owner_email,
    sp.display_name as plan_name,
    os.status as subscription_status,
    COALESCE(os.mrr, 0) as mrr,
    (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id)::integer as users_count,
    (SELECT COUNT(*) FROM projects p WHERE p.organization_id = o.id)::integer as projects_count,
    o.is_blocked,
    o.created_at
  FROM organizations o
  LEFT JOIN users owner ON o.owner_id = owner.id
  LEFT JOIN organization_subscriptions os ON o.id = os.organization_id
  LEFT JOIN subscription_plans sp ON os.plan_id = sp.id
  WHERE o.is_deleted = false
    AND (search_query IS NULL OR 
         o.name ILIKE '%' || search_query || '%' OR 
         owner.email ILIKE '%' || search_query || '%')
  ORDER BY o.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- Создаем первого супер-админа (можно изменить email на ваш)
-- Раскомментируйте и измените email после применения миграции
-- UPDATE users SET is_super_admin = true WHERE email = 'your-email@example.com';
