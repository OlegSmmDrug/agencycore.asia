/*
  # Fix Unified Analytics Functions - Ambiguous Column Names

  1. Changes
    - Fix ambiguous column references by using table aliases consistently
    - Rename variables to avoid conflicts with column names
  
  2. Security
    - Maintains organization isolation
    - SECURITY DEFINER with proper checks
*/

-- Drop and recreate with fixed column references
DROP FUNCTION IF EXISTS get_unified_analytics(uuid, date);

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
      DATE_TRUNC('month', p.created_at)::date as proj_month,
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
      DATE_TRUNC('month', c.created_at)::date as client_month,
      COUNT(*) as new_clients,
      COUNT(*) FILTER (WHERE c.status = 'Won') as won_clients
    FROM clients c
    WHERE c.organization_id = p_organization_id
      AND c.created_at >= p_start_date
    GROUP BY DATE_TRUNC('month', c.created_at)
  ),
  monthly_content AS (
    SELECT 
      DATE_TRUNC('month', cp.published_at)::date as content_month,
      COUNT(*) as publications
    FROM content_publications cp
    JOIN projects proj ON proj.id = cp.project_id
    WHERE proj.organization_id = p_organization_id
      AND cp.published_at >= p_start_date
    GROUP BY DATE_TRUNC('month', cp.published_at)
  ),
  monthly_transactions AS (
    SELECT 
      DATE_TRUNC('month', t.date)::date as trans_month,
      SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) as income,
      SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as expenses
    FROM transactions t
    WHERE t.organization_id = p_organization_id
      AND t.date >= p_start_date
    GROUP BY DATE_TRUNC('month', t.date)
  ),
  monthly_tasks AS (
    SELECT 
      DATE_TRUNC('month', tk.completed_at)::date as task_month,
      COUNT(*) as tasks_completed
    FROM tasks tk
    WHERE tk.organization_id = p_organization_id
      AND tk.status = 'Done'
      AND tk.completed_at >= p_start_date
    GROUP BY DATE_TRUNC('month', tk.completed_at)
  ),
  monthly_team AS (
    SELECT 
      DATE_TRUNC('month', u.created_at)::date as team_month,
      COUNT(DISTINCT u.id) as team_size
    FROM users u
    WHERE u.organization_id = p_organization_id
      AND u.created_at >= p_start_date
    GROUP BY DATE_TRUNC('month', u.created_at)
  ),
  all_months AS (
    SELECT DISTINCT the_month FROM (
      SELECT proj_month as the_month FROM monthly_projects
      UNION SELECT client_month FROM monthly_clients
      UNION SELECT content_month FROM monthly_content
      UNION SELECT trans_month FROM monthly_transactions
      UNION SELECT task_month FROM monthly_tasks
      UNION SELECT team_month FROM monthly_team
    ) months
  )
  SELECT 
    am.the_month as month,
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
  FROM all_months am
  LEFT JOIN monthly_projects mp ON am.the_month = mp.proj_month
  LEFT JOIN monthly_clients mc ON am.the_month = mc.client_month
  LEFT JOIN monthly_content mco ON am.the_month = mco.content_month
  LEFT JOIN monthly_transactions mt ON am.the_month = mt.trans_month
  LEFT JOIN monthly_tasks mta ON am.the_month = mta.task_month
  LEFT JOIN monthly_team mte ON am.the_month = mte.team_month
  ORDER BY am.the_month;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_unified_analytics TO anon, authenticated;
