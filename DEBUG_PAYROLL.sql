-- ДИАГНОСТИКА ПРОБЛЕМ С РАСЧЕТОМ ЗАРПЛАТ

-- 1. Проверка схем зарплат для SMM
SELECT
  ss.target_type,
  ss.target_id,
  ss.base_salary,
  jsonb_pretty(ss.kpi_rules) as kpi_rules
FROM salary_schemes ss
WHERE ss.target_id LIKE '%SMM%' OR ss.target_id LIKE '%Контент%'
ORDER BY ss.target_type, ss.target_id;

-- 2. Проверка задач с типами контента за последний месяц
SELECT
  t.type,
  t.title,
  t.status,
  t.completed_at,
  u.name as assignee_name,
  u.job_title,
  p.name as project_name
FROM tasks t
LEFT JOIN users u ON t.assignee_id = u.id
LEFT JOIN projects p ON t.project_id = p.id
WHERE
  (t.type LIKE '%content%' OR t.type IN ('Post', 'Reels', 'Stories'))
  AND t.completed_at >= CURRENT_DATE - INTERVAL '60 days'
ORDER BY t.completed_at DESC
LIMIT 50;

-- 3. Проверка типов задач используемых в системе
SELECT
  type,
  COUNT(*) as count,
  COUNT(CASE WHEN status = 'Done' THEN 1 END) as done_count,
  COUNT(CASE WHEN status = 'Done' AND completed_at IS NOT NULL THEN 1 END) as done_with_date
FROM tasks
WHERE type IS NOT NULL
GROUP BY type
ORDER BY count DESC;

-- 4. Проверка calculator_services (динамические типы задач)
SELECT
  cs.id,
  cs.name,
  cs.category,
  cs.is_active,
  stm.task_type,
  stm.metric_label
FROM calculator_services cs
LEFT JOIN service_task_mappings stm ON cs.id = stm.service_id
WHERE cs.category = 'smm' AND cs.is_active = true
ORDER BY cs.sort_order;

-- 5. Проверка задач SMM сотрудников за январь 2026
SELECT
  u.name,
  u.job_title,
  COUNT(*) as total_tasks,
  COUNT(CASE WHEN t.status = 'Done' THEN 1 END) as done_tasks,
  COUNT(CASE WHEN t.status = 'Done' AND t.completed_at IS NOT NULL THEN 1 END) as done_with_date,
  COUNT(CASE
    WHEN t.status = 'Done'
    AND t.completed_at >= '2026-01-01'
    AND t.completed_at < '2026-02-01'
    THEN 1
  END) as done_in_jan_2026
FROM users u
LEFT JOIN tasks t ON t.assignee_id = u.id
WHERE u.job_title LIKE '%SMM%' OR u.job_title LIKE '%Контент%'
GROUP BY u.id, u.name, u.job_title;

-- 6. Проверка конкретных задач SMM за январь 2026 с детальной информацией
SELECT
  u.name as user_name,
  u.job_title,
  t.title as task_title,
  t.type as task_type,
  t.status,
  t.completed_at,
  p.name as project_name
FROM tasks t
JOIN users u ON t.assignee_id = u.id
LEFT JOIN projects p ON t.project_id = p.id
WHERE
  (u.job_title LIKE '%SMM%' OR u.job_title LIKE '%Контент%')
  AND t.status = 'Done'
  AND t.completed_at >= '2026-01-01'
  AND t.completed_at < '2026-02-01'
ORDER BY u.name, t.completed_at;

-- 7. Проверка схем зарплат - все правила
SELECT
  ss.id,
  ss.target_type,
  ss.target_id,
  ss.base_salary,
  jsonb_array_length(ss.kpi_rules) as rules_count,
  rule.value->>'taskType' as task_type,
  (rule.value->>'value')::numeric as rate
FROM salary_schemes ss
CROSS JOIN LATERAL jsonb_array_elements(ss.kpi_rules) AS rule
WHERE jsonb_array_length(ss.kpi_rules) > 0
ORDER BY ss.target_type, ss.target_id, task_type;

-- 8. Проверка мэппинга сервисов к типам задач
SELECT
  cs.name as service_name,
  cs.category,
  stm.task_type,
  stm.metric_label,
  cs.is_active
FROM calculator_services cs
LEFT JOIN service_task_mappings stm ON cs.id = stm.service_id
WHERE cs.category = 'smm'
ORDER BY cs.sort_order;
