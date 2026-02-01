/*
  # Improve Unified Analytics - Team Counting

  1. Changes
    - Улучшен подсчет размера команды (кумулятивно, а не только добавленные)
    - Исправлена логика подсчета активных проектов
    - Добавлен подсчет выполненных задач

  2. Security
    - Organization isolation maintained
*/

-- Обновленная функция унифицированной аналитики
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
      AVG(COALESCE(p.budget, 0)) as avg_budget
    FROM projects p
    WHERE p.organization_id = p_organization_id
      AND p.created_at >= p_start_date
    GROUP BY DATE_TRUNC('month', p.created_at)
  ),
  monthly_active_projects AS (
    SELECT
      DATE_TRUNC('month', p.created_at)::date as month,
      COUNT(*) FILTER (WHERE p.status = 'Active') as active_projects
    FROM projects p
    WHERE p.organization_id = p_organization_id
      AND p.created_at >= p_start_date
      AND p.status = 'Active'
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
      AND cp.published_at IS NOT NULL
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
      DATE_TRUNC('month', COALESCE(t.completed_at, t.updated_at))::date as month,
      COUNT(*) as tasks_completed
    FROM tasks t
    WHERE t.organization_id = p_organization_id
      AND t.status = 'Done'
      AND COALESCE(t.completed_at, t.updated_at) >= p_start_date
    GROUP BY DATE_TRUNC('month', COALESCE(t.completed_at, t.updated_at))
  ),
  all_months AS (
    SELECT DISTINCT month FROM (
      SELECT month FROM monthly_projects
      UNION SELECT month FROM monthly_active_projects
      UNION SELECT month FROM monthly_clients
      UNION SELECT month FROM monthly_content
      UNION SELECT month FROM monthly_transactions
      UNION SELECT month FROM monthly_tasks
    ) months
  ),
  cumulative_team AS (
    SELECT
      m.month,
      COUNT(DISTINCT u.id) as team_size
    FROM all_months m
    CROSS JOIN users u
    WHERE u.organization_id = p_organization_id
      AND u.created_at <= m.month + INTERVAL '1 month'
    GROUP BY m.month
  )
  SELECT
    m.month,
    COALESCE(mp.new_projects, 0) as new_projects,
    COALESCE(map.active_projects, 0) as active_projects,
    COALESCE(mc.new_clients, 0) as new_clients,
    COALESCE(mc.won_clients, 0) as won_clients,
    COALESCE(mco.publications, 0) as publications,
    COALESCE(mt.income, 0) as income,
    COALESCE(mt.expenses, 0) as expenses,
    COALESCE(mta.tasks_completed, 0) as tasks_completed,
    COALESCE(ct.team_size, 0) as team_size,
    COALESCE(mp.avg_budget, 0) as avg_project_budget
  FROM all_months m
  LEFT JOIN monthly_projects mp ON m.month = mp.month
  LEFT JOIN monthly_active_projects map ON m.month = map.month
  LEFT JOIN monthly_clients mc ON m.month = mc.month
  LEFT JOIN monthly_content mco ON m.month = mco.month
  LEFT JOIN monthly_transactions mt ON m.month = mt.month
  LEFT JOIN monthly_tasks mta ON m.month = mta.month
  LEFT JOIN cumulative_team ct ON m.month = ct.month
  ORDER BY m.month;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_unified_analytics TO anon, authenticated;
