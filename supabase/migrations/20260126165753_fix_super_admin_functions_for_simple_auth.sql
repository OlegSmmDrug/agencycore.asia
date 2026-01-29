/*
  # Исправление функций супер-администратора для простой аутентификации

  ## Описание
  Исправляет функции get_platform_statistics и get_organizations_list
  для работы без Supabase Auth (auth.uid()). Теперь функции принимают
  user_id как параметр и проверяют is_super_admin напрямую.

  ## Изменения
  1. Обновлена функция get_platform_statistics
     - Добавлен параметр user_id
     - Проверка is_super_admin по user_id вместо auth.uid()
  
  2. Обновлена функция get_organizations_list
     - Добавлен параметр user_id
     - Проверка is_super_admin по user_id вместо auth.uid()

  ## Безопасность
  - Только пользователи с is_super_admin = true могут вызывать функции
  - Проверка выполняется через переданный user_id
*/

-- Функция для получения общей статистики платформы
CREATE OR REPLACE FUNCTION get_platform_statistics(user_id uuid DEFAULT NULL)
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
  IF user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = user_id AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied: super admin only';
  END IF;

  -- Считаем общий MRR (если таблица subscription существует)
  SELECT COALESCE(SUM(mrr), 0)
  INTO total_mrr
  FROM organization_subscriptions
  WHERE status IN ('active', 'trial');

  -- Если таблица organization_subscriptions не существует, устанавливаем 0
  EXCEPTION WHEN undefined_table THEN
    total_mrr := 0;

  -- Считаем активных пользователей
  SELECT COUNT(DISTINCT u.id)
  INTO active_users_count
  FROM users u
  LEFT JOIN organizations o ON u.organization_id = o.id
  WHERE (o.id IS NULL OR (o.is_deleted = false AND o.is_blocked = false));

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
  BEGIN
    SELECT COUNT(DISTINCT organization_id)
    INTO churned_orgs_last_month
    FROM organization_subscriptions
    WHERE canceled_at >= NOW() - INTERVAL '30 days';
  EXCEPTION WHEN undefined_table THEN
    churned_orgs_last_month := 0;
  END;

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
  user_id uuid DEFAULT NULL,
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
  IF user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = user_id AND is_super_admin = true
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
