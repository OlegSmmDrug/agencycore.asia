/*
  # Add KPI Automation and Content Calculation System

  1. New Table: kpi_presets
    - Stores predefined KPI templates for quick selection
    - Includes SMM and Advertising metrics with descriptions
    - Helps users choose appropriate KPIs based on their project type

  2. Extensions to projects table:
    - `kpi_last_synced_at` (timestamptz) - Timestamp of last KPI synchronization
    - `content_auto_calculate` (boolean) - Enable/disable automatic content calculation
    - `content_last_calculated_at` (timestamptz) - Timestamp of last content calculation
    - `posts_plan`, `posts_fact`, `reels_plan`, `reels_fact`, `stories_plan`, `stories_fact` columns
      are already present, we just ensure they exist

  3. Purpose:
    - Enable automatic KPI data fetching from LiveDune and Facebook Ads
    - Track when data was last synchronized
    - Provide preset KPI templates for quick project setup
    - Enable automatic content fact calculation from completed tasks

  4. Security:
    - Public read access to kpi_presets (reference data)
*/

-- Create kpi_presets table
CREATE TABLE IF NOT EXISTS kpi_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL CHECK (category IN ('smm', 'ads')),
  metric_key text NOT NULL,
  source text NOT NULL CHECK (source IN ('livedune', 'facebook', 'manual')),
  default_plan integer DEFAULT 0,
  unit text DEFAULT '',
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add automation columns to projects table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'kpi_last_synced_at'
  ) THEN
    ALTER TABLE projects ADD COLUMN kpi_last_synced_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'content_auto_calculate'
  ) THEN
    ALTER TABLE projects ADD COLUMN content_auto_calculate boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'content_last_calculated_at'
  ) THEN
    ALTER TABLE projects ADD COLUMN content_last_calculated_at timestamptz;
  END IF;
END $$;

-- Enable RLS on kpi_presets
ALTER TABLE kpi_presets ENABLE ROW LEVEL SECURITY;

-- Public read access to kpi_presets
CREATE POLICY "Allow public read access to kpi_presets"
  ON kpi_presets FOR SELECT
  USING (true);

-- Insert predefined SMM KPIs
INSERT INTO kpi_presets (name, description, category, metric_key, source, unit, display_order) VALUES
  ('Охваты', 'Общий охват публикаций за период', 'smm', 'reach', 'livedune', '', 1),
  ('ER (Engagement Rate)', 'Средний процент вовлеченности аудитории', 'smm', 'er', 'livedune', '%', 2),
  ('Подписчики', 'Текущее количество подписчиков', 'smm', 'followers', 'livedune', '', 3),
  ('Прирост подписчиков', 'Изменение количества подписчиков за период', 'smm', 'followers_diff', 'livedune', '', 4),
  ('Просмотры', 'Общее количество просмотров контента', 'smm', 'views', 'livedune', '', 5),
  ('Лайки (среднее)', 'Среднее количество лайков на публикацию', 'smm', 'likes_avg', 'livedune', '', 6),
  ('Комментарии (среднее)', 'Среднее количество комментариев на публикацию', 'smm', 'comments_avg', 'livedune', '', 7),
  ('Сохранения', 'Количество сохранений контента', 'smm', 'saves', 'livedune', '', 8)
ON CONFLICT DO NOTHING;

-- Insert predefined Advertising KPIs
INSERT INTO kpi_presets (name, description, category, metric_key, source, unit, display_order) VALUES
  ('CTR', 'Процент кликов по рекламе (Click-Through Rate)', 'ads', 'ctr', 'facebook', '%', 11),
  ('CPC', 'Стоимость клика (Cost Per Click)', 'ads', 'cpc', 'facebook', '$', 12),
  ('CPM', 'Стоимость 1000 показов (Cost Per Mille)', 'ads', 'cpm', 'facebook', '$', 13),
  ('CPL', 'Стоимость лида (Cost Per Lead)', 'ads', 'cpl', 'facebook', '$', 14),
  ('ROAS', 'Окупаемость рекламных расходов (Return on Ad Spend)', 'ads', 'roas', 'facebook', 'x', 15),
  ('Лиды', 'Общее количество полученных лидов', 'ads', 'leads', 'facebook', '', 16),
  ('Охват рекламы', 'Уникальный охват рекламных объявлений', 'ads', 'reach', 'facebook', '', 17),
  ('Расход', 'Общие рекламные расходы за период', 'ads', 'spend', 'facebook', '$', 18),
  ('Конверсии', 'Количество целевых действий', 'ads', 'conversions', 'facebook', '', 19)
ON CONFLICT DO NOTHING;