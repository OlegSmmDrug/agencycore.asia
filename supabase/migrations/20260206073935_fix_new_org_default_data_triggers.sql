/*
  # Fix Default Data Creation for New Organizations

  1. Problem
    - The `create_default_calculator_categories()` trigger function was dropped
      via CASCADE in a cleanup migration and never re-created as a trigger
    - New organizations get no default calculator categories
    - New organizations get no default job titles
    - This causes the calculator page to show "no sections" after registration

  2. Fix
    - Re-create `create_default_calculator_categories()` as a proper TRIGGER function
    - Create `create_default_job_titles_for_org()` trigger function
    - Create triggers on organizations table for both
    - Backfill missing data for any organizations that were created without defaults
*/

-- 1. Re-create calculator categories trigger function
CREATE OR REPLACE FUNCTION create_default_calculator_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO calculator_categories (id, organization_id, name, icon, color, sort_order, is_active)
  VALUES
    ('smm', NEW.id, 'SMM', '📱', '#3b82f6', 1, true),
    ('target', NEW.id, 'Таргет', '🎯', '#8b5cf6', 2, true),
    ('sites', NEW.id, 'Сайты', '🌐', '#10b981', 3, true),
    ('video', NEW.id, 'Продакшн', '🎬', '#f59e0b', 4, true)
  ON CONFLICT (id, organization_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2. Create trigger for calculator categories
CREATE TRIGGER trigger_create_default_calculator_categories
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION create_default_calculator_categories();

-- 3. Create job titles trigger function
CREATE OR REPLACE FUNCTION create_default_job_titles_for_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO job_titles (organization_id, title)
  VALUES
    (NEW.id, 'CEO'),
    (NEW.id, 'PM / Project Manager'),
    (NEW.id, 'SMM / Контент-менеджер'),
    (NEW.id, 'Targetologist / Таргетолог'),
    (NEW.id, 'Videographer / Видеограф'),
    (NEW.id, 'Mobilograph / Мобилограф'),
    (NEW.id, 'Photographer / Фотограф'),
    (NEW.id, 'Designer / Дизайнер'),
    (NEW.id, 'Copywriter / Копирайтер'),
    (NEW.id, 'Sales manager'),
    (NEW.id, 'Intern / Стажер'),
    (NEW.id, 'Бухгалтер')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- 4. Create trigger for job titles
CREATE TRIGGER trigger_create_default_job_titles
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION create_default_job_titles_for_org();

-- 5. Backfill calculator categories for organizations that are missing them
DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN 
    SELECT o.id FROM organizations o
    WHERE NOT EXISTS (
      SELECT 1 FROM calculator_categories cc WHERE cc.organization_id = o.id
    )
  LOOP
    INSERT INTO calculator_categories (id, organization_id, name, icon, color, sort_order, is_active)
    VALUES
      ('smm', org_record.id, 'SMM', '📱', '#3b82f6', 1, true),
      ('target', org_record.id, 'Таргет', '🎯', '#8b5cf6', 2, true),
      ('sites', org_record.id, 'Сайты', '🌐', '#10b981', 3, true),
      ('video', org_record.id, 'Продакшн', '🎬', '#f59e0b', 4, true)
    ON CONFLICT (id, organization_id) DO NOTHING;
  END LOOP;
END $$;

-- 6. Backfill job titles for organizations that are missing them
DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN 
    SELECT o.id FROM organizations o
    WHERE NOT EXISTS (
      SELECT 1 FROM job_titles jt WHERE jt.organization_id = o.id
    )
  LOOP
    INSERT INTO job_titles (organization_id, title)
    VALUES
      (org_record.id, 'CEO'),
      (org_record.id, 'PM / Project Manager'),
      (org_record.id, 'SMM / Контент-менеджер'),
      (org_record.id, 'Targetologist / Таргетолог'),
      (org_record.id, 'Videographer / Видеограф'),
      (org_record.id, 'Mobilograph / Мобилограф'),
      (org_record.id, 'Photographer / Фотограф'),
      (org_record.id, 'Designer / Дизайнер'),
      (org_record.id, 'Copywriter / Копирайтер'),
      (org_record.id, 'Sales manager'),
      (org_record.id, 'Intern / Стажер'),
      (org_record.id, 'Бухгалтер')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
