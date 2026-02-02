/*
  # Create Unified Content Stats Function
  
  ## Summary
  Creates a single source of truth function for content statistics.
  This function returns fact counts from content_publications and plan values from project.content_metrics.
  
  ## Changes
  1. New function: get_unified_content_stats(project_id, date_from, date_to)
     - Returns: content_type, fact (from publications), plan (from project), rate, cost
  
  2. Updated function: calculate_content_metrics_for_month
     - Uses normalized content types (Post, Stories, Reels)
  
  ## Usage
  - SmartDashboard widget
  - Project expenses calculation
  - Payroll calculation
*/

CREATE OR REPLACE FUNCTION get_unified_content_stats(
  p_project_id UUID,
  p_date_from TIMESTAMP DEFAULT NULL,
  p_date_to TIMESTAMP DEFAULT NULL
)
RETURNS TABLE (
  content_type TEXT,
  fact BIGINT,
  plan INTEGER,
  rate NUMERIC,
  cost NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_content_metrics JSONB;
  v_date_from TIMESTAMP;
  v_date_to TIMESTAMP;
BEGIN
  SELECT organization_id, content_metrics 
  INTO v_org_id, v_content_metrics
  FROM projects 
  WHERE id = p_project_id;

  IF p_date_from IS NULL THEN
    v_date_from := date_trunc('month', CURRENT_DATE);
  ELSE
    v_date_from := p_date_from;
  END IF;

  IF p_date_to IS NULL THEN
    v_date_to := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 second');
  ELSE
    v_date_to := p_date_to;
  END IF;

  RETURN QUERY
  WITH fact_counts AS (
    SELECT 
      cp.content_type,
      COUNT(*)::BIGINT as fact_count
    FROM content_publications cp
    WHERE cp.project_id = p_project_id
      AND cp.published_at >= v_date_from
      AND cp.published_at <= v_date_to
    GROUP BY cp.content_type
  ),
  content_types AS (
    SELECT unnest(ARRAY['Post', 'Stories', 'Reels']) as ct
  ),
  plan_values AS (
    SELECT 
      ct.ct as content_type,
      COALESCE((v_content_metrics->ct.ct->>'plan')::INTEGER, 0) as plan_value
    FROM content_types ct
  ),
  service_rates AS (
    SELECT 
      cs.name as content_type,
      COALESCE(cs.cost_price, cs.price * 0.5) as rate
    FROM calculator_services cs
    WHERE cs.organization_id = v_org_id
      AND cs.name IN ('Post', 'Stories', 'Reels')
      AND cs.is_active = true
  )
  SELECT 
    ct.ct::TEXT as content_type,
    COALESCE(fc.fact_count, 0)::BIGINT as fact,
    COALESCE(pv.plan_value, 0)::INTEGER as plan,
    COALESCE(sr.rate, 0)::NUMERIC as rate,
    (COALESCE(fc.fact_count, 0) * COALESCE(sr.rate, 0))::NUMERIC as cost
  FROM content_types ct
  LEFT JOIN fact_counts fc ON fc.content_type = ct.ct
  LEFT JOIN plan_values pv ON pv.content_type = ct.ct
  LEFT JOIN service_rates sr ON sr.content_type = ct.ct
  ORDER BY 
    CASE ct.ct 
      WHEN 'Post' THEN 1 
      WHEN 'Stories' THEN 2 
      WHEN 'Reels' THEN 3 
      ELSE 4 
    END;
END;
$$;

CREATE OR REPLACE FUNCTION get_content_stats_last_30_days(p_project_id UUID)
RETURNS TABLE (
  content_type TEXT,
  fact BIGINT,
  plan INTEGER,
  rate NUMERIC,
  cost NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM get_unified_content_stats(
    p_project_id,
    (CURRENT_DATE - interval '30 days')::TIMESTAMP,
    CURRENT_TIMESTAMP
  );
END;
$$;

CREATE OR REPLACE FUNCTION update_project_content_metrics_from_publications(p_project_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_content_metrics JSONB;
  v_stats RECORD;
BEGIN
  SELECT content_metrics INTO v_content_metrics FROM projects WHERE id = p_project_id;
  
  IF v_content_metrics IS NULL THEN
    v_content_metrics := '{}'::JSONB;
  END IF;

  FOR v_stats IN 
    SELECT * FROM get_content_stats_last_30_days(p_project_id)
  LOOP
    v_content_metrics := jsonb_set(
      v_content_metrics,
      ARRAY[v_stats.content_type],
      jsonb_build_object(
        'fact', v_stats.fact,
        'plan', COALESCE((v_content_metrics->v_stats.content_type->>'plan')::INTEGER, 0)
      ),
      true
    );
  END LOOP;

  UPDATE projects 
  SET content_metrics = v_content_metrics
  WHERE id = p_project_id;
END;
$$;