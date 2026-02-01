/*
  # Add test publications for other SMM managers

  1. Purpose
    - Adds test content publications for January 2026 for SMM managers who don't have data yet
    - Distributes publications across the month evenly
    - Uses first project from each SMM manager's project list

  2. SMM Managers to add data for:
    - Диана (Daily Logistics, Karamelka, etc)
    - Камила (Kawai)
    - Лиза Горгопко (Egida, Eva Trend)
    - Мадина (ABAY KAZ ONLINE, Terek Almaz)
    - Татьяна Юрьевна (EMEX.KZ, Levi's, СММ ДРУГ)

  3. Content distribution per manager:
    - 8 Posts (800₽ each = 6,400₽)
    - 50 Stories (500₽ each = 25,000₽)
    - 5 Reels (800₽ each = 4,000₽)
    - Total: 35,400₽ per month
*/

DO $$
DECLARE
  v_user_id UUID;
  v_project_id UUID;
  v_org_id UUID;
  v_day INT;
  v_content_type TEXT;
  v_quantity INT;
  v_counter INT;
BEGIN
  -- Диана
  SELECT u.id, p.id, p.organization_id
  INTO v_user_id, v_project_id, v_org_id
  FROM users u
  JOIN projects p ON u.id = ANY(p.team_ids)
  WHERE u.name = 'Диана' AND u.job_title = 'SMM / Контент-менеджер'
  ORDER BY p.name
  LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    FOR v_content_type, v_quantity IN 
      VALUES ('Post', 8), ('Stories ', 50), ('Reels Production', 5)
    LOOP
      FOR v_counter IN 1..v_quantity LOOP
        v_day := ((v_counter - 1) % 28) + 1;
        INSERT INTO content_publications (
          project_id, content_type, published_at, assigned_user_id, organization_id, description
        ) VALUES (
          v_project_id,
          v_content_type,
          ('2026-01-' || LPAD(v_day::text, 2, '0') || ' ' || (8 + (v_counter % 12))::text || ':00:00')::timestamptz,
          v_user_id,
          v_org_id,
          'Тестовая публикация'
        );
      END LOOP;
    END LOOP;
    RAISE NOTICE 'Added publications for Диана';
  END IF;

  -- Камила
  SELECT u.id, p.id, p.organization_id
  INTO v_user_id, v_project_id, v_org_id
  FROM users u
  JOIN projects p ON u.id = ANY(p.team_ids)
  WHERE u.name = 'Камила' AND u.job_title = 'SMM / Контент-менеджер'
  ORDER BY p.name
  LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    FOR v_content_type, v_quantity IN 
      VALUES ('Post', 8), ('Stories ', 50), ('Reels Production', 5)
    LOOP
      FOR v_counter IN 1..v_quantity LOOP
        v_day := ((v_counter - 1) % 28) + 1;
        INSERT INTO content_publications (
          project_id, content_type, published_at, assigned_user_id, organization_id, description
        ) VALUES (
          v_project_id,
          v_content_type,
          ('2026-01-' || LPAD(v_day::text, 2, '0') || ' ' || (8 + (v_counter % 12))::text || ':00:00')::timestamptz,
          v_user_id,
          v_org_id,
          'Тестовая публикация'
        );
      END LOOP;
    END LOOP;
    RAISE NOTICE 'Added publications for Камила';
  END IF;

  -- Лиза Горгопко
  SELECT u.id, p.id, p.organization_id
  INTO v_user_id, v_project_id, v_org_id
  FROM users u
  JOIN projects p ON u.id = ANY(p.team_ids)
  WHERE u.name = 'Лиза Горгопко' AND u.job_title = 'SMM / Контент-менеджер'
  ORDER BY p.name
  LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    FOR v_content_type, v_quantity IN 
      VALUES ('Post', 8), ('Stories ', 50), ('Reels Production', 5)
    LOOP
      FOR v_counter IN 1..v_quantity LOOP
        v_day := ((v_counter - 1) % 28) + 1;
        INSERT INTO content_publications (
          project_id, content_type, published_at, assigned_user_id, organization_id, description
        ) VALUES (
          v_project_id,
          v_content_type,
          ('2026-01-' || LPAD(v_day::text, 2, '0') || ' ' || (8 + (v_counter % 12))::text || ':00:00')::timestamptz,
          v_user_id,
          v_org_id,
          'Тестовая публикация'
        );
      END LOOP;
    END LOOP;
    RAISE NOTICE 'Added publications for Лиза Горгопко';
  END IF;

  -- Мадина
  SELECT u.id, p.id, p.organization_id
  INTO v_user_id, v_project_id, v_org_id
  FROM users u
  JOIN projects p ON u.id = ANY(p.team_ids)
  WHERE u.name = 'Мадина' AND u.job_title = 'SMM / Контент-менеджер'
  ORDER BY p.name
  LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    FOR v_content_type, v_quantity IN 
      VALUES ('Post', 8), ('Stories ', 50), ('Reels Production', 5)
    LOOP
      FOR v_counter IN 1..v_quantity LOOP
        v_day := ((v_counter - 1) % 28) + 1;
        INSERT INTO content_publications (
          project_id, content_type, published_at, assigned_user_id, organization_id, description
        ) VALUES (
          v_project_id,
          v_content_type,
          ('2026-01-' || LPAD(v_day::text, 2, '0') || ' ' || (8 + (v_counter % 12))::text || ':00:00')::timestamptz,
          v_user_id,
          v_org_id,
          'Тестовая публикация'
        );
      END LOOP;
    END LOOP;
    RAISE NOTICE 'Added publications for Мадина';
  END IF;

  -- Татьяна Юрьевна
  SELECT u.id, p.id, p.organization_id
  INTO v_user_id, v_project_id, v_org_id
  FROM users u
  JOIN projects p ON u.id = ANY(p.team_ids)
  WHERE u.name = 'Татьяна Юрьевна' AND u.job_title = 'SMM / Контент-менеджер'
  ORDER BY p.name
  LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    FOR v_content_type, v_quantity IN 
      VALUES ('Post', 8), ('Stories ', 50), ('Reels Production', 5)
    LOOP
      FOR v_counter IN 1..v_quantity LOOP
        v_day := ((v_counter - 1) % 28) + 1;
        INSERT INTO content_publications (
          project_id, content_type, published_at, assigned_user_id, organization_id, description
        ) VALUES (
          v_project_id,
          v_content_type,
          ('2026-01-' || LPAD(v_day::text, 2, '0') || ' ' || (8 + (v_counter % 12))::text || ':00:00')::timestamptz,
          v_user_id,
          v_org_id,
          'Тестовая публикация'
        );
      END LOOP;
    END LOOP;
    RAISE NOTICE 'Added publications for Татьяна Юрьевна';
  END IF;

  RAISE NOTICE '=== Test Publications Added ===';
END $$;

-- Verify results
SELECT 
  u.name,
  COUNT(cp.id) as publications_count,
  SUM(CASE WHEN cp.content_type = 'Post' THEN 1 ELSE 0 END) as posts,
  SUM(CASE WHEN cp.content_type = 'Stories ' THEN 1 ELSE 0 END) as stories,
  SUM(CASE WHEN cp.content_type = 'Reels Production' THEN 1 ELSE 0 END) as reels
FROM users u
LEFT JOIN content_publications cp ON cp.assigned_user_id = u.id
  AND cp.published_at >= '2026-01-01'
  AND cp.published_at < '2026-02-01'
WHERE u.job_title = 'SMM / Контент-менеджер'
GROUP BY u.name
ORDER BY u.name;
