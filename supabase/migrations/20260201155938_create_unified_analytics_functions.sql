/*
  # Unified Analytics System

  1. New Functions
    - `get_unified_analytics` - получает метрики по месяцам со связями между блоками
    - `get_monthly_stats_fallback` - упрощенная версия на случай ошибок
  
  2. Features
    - Временные ряды всех метрик
    - Связи: клиенты → проекты → финансы → контент → команда
    - Агрегация по месяцам
    - Производительность команды
  
  3. Security
    - Organization isolation via p_organization_id parameter
    - Public access для использования из frontend
*/

-- Основная функция унифицированной аналитики
CREATE OR REPLACE FUNCTION get_unified_analytics(
  p_organization_id uuid,
  p_start_date date DEFAULT '2020-01-01'
)
RETURNS TABLE (
  month date,
  new_projects bigint,
  active_projects bigint,
  new_clients bigint,
  won_clients bigint,
  publications bigint,
  income numeric,
  expenses numeric,
  tasks_completed bigint,
  team_size bigint,
  avg_project_budget numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH monthly_projects AS (
    SELECT 
      DATE_TRUNC('month', p.created_at)::date as month,
      COUNT(*) as new_projects,
      COUNT(*) FILTER (WHERE p.status = 'Active') as active_projects,
      AVG(COALESCE(p.budget, 0)) as avg_budget
    FROM projects p
    WHERE p.organization_id = p_organization_id
      AND p.created_at >= p_start_date
    GROUP BY DATE_TRUNC('month', p.created_at)
  ),
  monthly_clients AS (
    SELECT 
      DATE_TRUNC('month', c.created_at)::date as month,
      COUNT(*) as new_clients,
      COUNT(*) FILTER (WHERE c.status = 'Won') as won_clients
    FROM clients c
    WHERE c.organization_id = p_organization_id
      AND c.created_at >= p_start_date
    GROUP BY DATE_TRUNC('month', c.created_at)
  ),
  monthly_content AS (
    SELECT 
      DATE_TRUNC('month', cp.published_at)::date as month,
      COUNT(*) as publications
    FROM content_publications cp
    JOIN projects p ON p.id = cp.project_id
    WHERE p.organization_id = p_organization_id
      AND cp.published_at >= p_start_date
    GROUP BY DATE_TRUNC('month', cp.published_at)
  ),
  monthly_transactions AS (
    SELECT 
      DATE_TRUNC('month', t.date)::date as month,
      SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) as income,
      SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as expenses
    FROM transactions t
    WHERE t.organization_id = p_organization_id
      AND t.date >= p_start_date
    GROUP BY DATE_TRUNC('month', t.date)
  ),
  monthly_tasks AS (
    SELECT 
      DATE_TRUNC('month', t.completed_at)::date as month,
      COUNT(*) as tasks_completed
    FROM tasks t
    WHERE t.organization_id = p_organization_id
      AND t.status = 'Done'
      AND t.completed_at >= p_start_date
    GROUP BY DATE_TRUNC('month', t.completed_at)
  ),
  monthly_team AS (
    SELECT 
      DATE_TRUNC('month', u.created_at)::date as month,
      COUNT(DISTINCT u.id) as team_size
    FROM users u
    WHERE u.organization_id = p_organization_id
      AND u.created_at >= p_start_date
    GROUP BY DATE_TRUNC('month', u.created_at)
  ),
  all_months AS (
    SELECT DISTINCT month FROM (
      SELECT month FROM monthly_projects
      UNION SELECT month FROM monthly_clients
      UNION SELECT month FROM monthly_content
      UNION SELECT month FROM monthly_transactions
      UNION SELECT month FROM monthly_tasks
      UNION SELECT month FROM monthly_team
    ) months
  )
  SELECT 
    m.month,
    COALESCE(mp.new_projects, 0) as new_projects,
    COALESCE(mp.active_projects, 0) as active_projects,
    COALESCE(mc.new_clients, 0) as new_clients,
    COALESCE(mc.won_clients, 0) as won_clients,
    COALESCE(mco.publications, 0) as publications,
    COALESCE(mt.income, 0) as income,
    COALESCE(mt.expenses, 0) as expenses,
    COALESCE(mta.tasks_completed, 0) as tasks_completed,
    COALESCE(mte.team_size, 0) as team_size,
    COALESCE(mp.avg_budget, 0) as avg_project_budget
  FROM all_months m
  LEFT JOIN monthly_projects mp ON m.month = mp.month
  LEFT JOIN monthly_clients mc ON m.month = mc.month
  LEFT JOIN monthly_content mco ON m.month = mco.month
  LEFT JOIN monthly_transactions mt ON m.month = mt.month
  LEFT JOIN monthly_tasks mta ON m.month = mta.month
  LEFT JOIN monthly_team mte ON m.month = mte.month
  ORDER BY m.month;
END;
$$;

-- Упрощенная версия для fallback
CREATE OR REPLACE FUNCTION get_monthly_stats_fallback(
  p_organization_id uuid
)
RETURNS TABLE (
  month date,
  new_projects bigint,
  active_projects bigint,
  new_clients bigint,
  won_clients bigint,
  publications bigint,
  income numeric,
  expenses numeric,
  tasks_completed bigint,
  team_size bigint,
  avg_project_budget numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE_TRUNC('month', NOW())::date as month,
    COUNT(DISTINCT p.id) as new_projects,
    COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'Active') as active_projects,
    COUNT(DISTINCT c.id) as new_clients,
    COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'Won') as won_clients,
    0::bigint as publications,
    COALESCE(SUM(t.amount) FILTER (WHERE t.amount > 0), 0) as income,
    COALESCE(SUM(ABS(t.amount)) FILTER (WHERE t.amount < 0), 0) as expenses,
    0::bigint as tasks_completed,
    COUNT(DISTINCT u.id) as team_size,
    COALESCE(AVG(p.budget), 0) as avg_project_budget
  FROM projects p
  LEFT JOIN clients c ON c.organization_id = p_organization_id
  LEFT JOIN transactions t ON t.organization_id = p_organization_id
  LEFT JOIN users u ON u.organization_id = p_organization_id
  WHERE p.organization_id = p_organization_id
  GROUP BY DATE_TRUNC('month', NOW());
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_unified_analytics TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_monthly_stats_fallback TO anon, authenticated;
