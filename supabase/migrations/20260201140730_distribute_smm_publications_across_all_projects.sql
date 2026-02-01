/*
  # Distribute SMM publications across all projects

  1. Purpose
    - Removes old test publications with single project per SMM
    - Adds publications distributed across ALL projects for each SMM manager
    - Each SMM's publications are split proportionally across their projects

  2. Distribution strategy:
    - Total per month: 8 Posts, 50 Stories, 5 Reels
    - Publications are distributed evenly across all projects
    - Dates are spread across January 2026

  3. SMM Managers:
    - Диана: 5 projects (Daily Logistics, Karamelka, Kusto Home, Qazaq people, Абильжан ЛБ)
    - Камила: 1 project (Kawai)
    - Лиза Горгопко: 2 projects (Egida, Eva Trend)
    - Мадина: 4 projects (ABAY KAZ ONLINE, Terek Almaz, TEREK ALMAZ, ТОО "ABAY ACADEMY ONLINE")
    - Татьяна Юрьевна: 3 projects (EMEX.KZ, Levi's, СММ ДРУГ)
*/

-- Delete old test publications
DELETE FROM content_publications 
WHERE description = 'Тестовая публикация'
  AND published_at >= '2026-01-01'
  AND published_at < '2026-02-01';

DO $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_org_id UUID;
  v_projects UUID[];
  v_project_id UUID;
  v_project_index INT;
  v_total_projects INT;
  v_content_type TEXT;
  v_posts_per_project INT;
  v_stories_per_project INT;
  v_reels_per_project INT;
  v_counter INT;
  v_day INT;
BEGIN
  -- Process each SMM manager
  FOR v_user_id, v_user_name, v_projects IN
    SELECT 
      u.id,
      u.name,
      array_agg(p.id ORDER BY p.name)
    FROM users u
    JOIN projects p ON u.id = ANY(p.team_ids)
    WHERE u.job_title = 'SMM / Контент-менеджер'
      AND u.name IN ('Диана', 'Камила', 'Лиза Горгопко', 'Мадина', 'Татьяна Юрьевна')
    GROUP BY u.id, u.name
  LOOP
    v_total_projects := array_length(v_projects, 1);
    
    -- Calculate distribution per project
    v_posts_per_project := CEIL(8.0 / v_total_projects);
    v_stories_per_project := CEIL(50.0 / v_total_projects);
    v_reels_per_project := CEIL(5.0 / v_total_projects);
    
    RAISE NOTICE 'Processing %: % projects (Posts: %, Stories: %, Reels: % per project)', 
      v_user_name, v_total_projects, v_posts_per_project, v_stories_per_project, v_reels_per_project;
    
    -- Get organization_id
    SELECT organization_id INTO v_org_id
    FROM projects WHERE id = v_projects[1];
    
    -- Distribute publications across all projects
    v_project_index := 1;
    FOREACH v_project_id IN ARRAY v_projects LOOP
      
      -- Posts for this project
      FOR v_counter IN 1..v_posts_per_project LOOP
        v_day := ((v_project_index - 1) * v_posts_per_project + v_counter - 1) % 28 + 1;
        INSERT INTO content_publications (
          project_id, content_type, published_at, assigned_user_id, organization_id, description
        ) VALUES (
          v_project_id,
          'Post',
          ('2026-01-' || LPAD(v_day::text, 2, '0') || ' ' || (9 + (v_counter % 10))::text || ':00:00')::timestamptz,
          v_user_id,
          v_org_id,
          'Тестовая публикация'
        );
      END LOOP;
      
      -- Stories for this project
      FOR v_counter IN 1..v_stories_per_project LOOP
        v_day := ((v_counter - 1) % 28) + 1;
        INSERT INTO content_publications (
          project_id, content_type, published_at, assigned_user_id, organization_id, description
        ) VALUES (
          v_project_id,
          'Stories ',
          ('2026-01-' || LPAD(v_day::text, 2, '0') || ' ' || (8 + (v_counter % 14))::text || ':' || (v_counter % 60)::text || ':00')::timestamptz,
          v_user_id,
          v_org_id,
          'Тестовая публикация'
        );
      END LOOP;
      
      -- Reels for this project
      FOR v_counter IN 1..v_reels_per_project LOOP
        v_day := ((v_project_index - 1) * v_reels_per_project + v_counter - 1) % 28 + 1;
        INSERT INTO content_publications (
          project_id, content_type, published_at, assigned_user_id, organization_id, description
        ) VALUES (
          v_project_id,
          'Reels Production',
          ('2026-01-' || LPAD(v_day::text, 2, '0') || ' ' || (10 + (v_counter % 9))::text || ':00:00')::timestamptz,
          v_user_id,
          v_org_id,
          'Тестовая публикация'
        );
      END LOOP;
      
      v_project_index := v_project_index + 1;
    END LOOP;
    
    RAISE NOTICE 'Completed % with % projects', v_user_name, v_total_projects;
  END LOOP;
  
  RAISE NOTICE '=== Publications distributed across all projects ===';
END $$;

-- Verify results - summary by SMM
SELECT 
  u.name,
  COUNT(DISTINCT cp.project_id) as projects_with_content,
  COUNT(cp.id) as total_publications,
  SUM(CASE WHEN cp.content_type = 'Post' THEN 1 ELSE 0 END) as posts,
  SUM(CASE WHEN cp.content_type = 'Stories ' THEN 1 ELSE 0 END) as stories,
  SUM(CASE WHEN cp.content_type = 'Reels Production' THEN 1 ELSE 0 END) as reels,
  SUM(
    CASE 
      WHEN cp.content_type = 'Post' THEN 800
      WHEN cp.content_type = 'Stories ' THEN 500
      WHEN cp.content_type = 'Reels Production' THEN 800
      ELSE 0
    END
  ) as total_earnings
FROM users u
LEFT JOIN content_publications cp ON cp.assigned_user_id = u.id
  AND cp.published_at >= '2026-01-01'
  AND cp.published_at < '2026-02-01'
WHERE u.job_title = 'SMM / Контент-менеджер'
GROUP BY u.name
ORDER BY total_earnings DESC;

-- Verify results - detailed by project
SELECT 
  u.name as smm_name,
  p.name as project_name,
  SUM(CASE WHEN cp.content_type = 'Post' THEN 1 ELSE 0 END) as posts,
  SUM(CASE WHEN cp.content_type = 'Stories ' THEN 1 ELSE 0 END) as stories,
  SUM(CASE WHEN cp.content_type = 'Reels Production' THEN 1 ELSE 0 END) as reels,
  COUNT(cp.id) as total_publications
FROM users u
JOIN content_publications cp ON cp.assigned_user_id = u.id
JOIN projects p ON p.id = cp.project_id
WHERE u.job_title = 'SMM / Контент-менеджер'
  AND cp.published_at >= '2026-01-01'
  AND cp.published_at < '2026-02-01'
  AND u.name IN ('Диана', 'Камила', 'Лиза Горгопко', 'Мадина', 'Татьяна Юрьевна')
GROUP BY u.name, p.name
ORDER BY u.name, p.name;
