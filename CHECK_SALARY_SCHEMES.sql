-- Этот SQL запрос покажет все схемы зарплат и их правила KPI
-- Выполните его в Supabase SQL Editor чтобы проверить данные

SELECT
  id,
  target_type,
  target_id,
  base_salary,
  jsonb_array_length(kpi_rules) as rules_count,
  kpi_rules,
  organization_id,
  created_at
FROM salary_schemes
ORDER BY target_type, target_id;

-- Проверка правил с нулевыми значениями
SELECT
  id,
  target_type,
  target_id,
  jsonb_pretty(kpi_rules) as kpi_rules_formatted
FROM salary_schemes
WHERE jsonb_array_length(kpi_rules) > 0
ORDER BY target_type, target_id;
