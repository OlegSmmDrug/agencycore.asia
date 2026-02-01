/*
  # Content Publication Tracking System

  1. New Tables
    - `content_publications`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to projects)
      - `content_type` (text) - Post, Reels, Stories и т.д.
      - `published_at` (timestamp) - ДАТА ПУБЛИКАЦИИ
      - `assigned_user_id` (uuid) - кто опубликовал
      - `organization_id` (uuid)
      - `created_at` (timestamp)
      - `description` (text, optional) - описание контента

  2. Purpose
    - Точный учет ДАТ публикации контента
    - Привязка к месяцам для расчета ЗП
    - Если контент опубликован в январе - оплачивается в январе
    - Если контент опубликован в феврале - оплачивается в феврале
*/

CREATE TABLE IF NOT EXISTS content_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content_type text NOT NULL,
  published_at timestamptz NOT NULL,
  assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_content_publications_project ON content_publications(project_id);
CREATE INDEX IF NOT EXISTS idx_content_publications_published_at ON content_publications(published_at);
CREATE INDEX IF NOT EXISTS idx_content_publications_user ON content_publications(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_content_publications_organization ON content_publications(organization_id);
CREATE INDEX IF NOT EXISTS idx_content_publications_type ON content_publications(content_type);

-- Индекс для поиска по месяцу + проекту + пользователю
CREATE INDEX IF NOT EXISTS idx_content_publications_month_lookup
  ON content_publications(organization_id, project_id, assigned_user_id, published_at);

-- RLS отключен для упрощения
ALTER TABLE content_publications DISABLE ROW LEVEL SECURITY;
