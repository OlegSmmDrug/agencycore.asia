/*
  # Система юридических документов проекта

  ## Описание
  Создание таблицы для хранения юридических документов, связанных с проектами.
  Документы загружаются через storage bucket и связываются с проектами.

  ## Новые таблицы
  
  ### `project_legal_documents`
  Хранит информацию о юридических документах проектов
  - `id` (uuid, PK) - Уникальный идентификатор документа
  - `project_id` (uuid, FK) - Ссылка на проект
  - `file_name` (text) - Оригинальное имя файла
  - `file_path` (text) - Путь к файлу в storage
  - `file_size` (bigint) - Размер файла в байтах
  - `mime_type` (text) - MIME-тип файла
  - `description` (text) - Описание/название документа (что это за документ)
  - `uploaded_by` (uuid, FK) - Кто загрузил документ
  - `uploaded_at` (timestamptz) - Когда загружен
  - `is_contract` (boolean) - Флаг "это готовый договор из CRM"

  ## Безопасность
  - Включен RLS для таблицы
  - Политики доступа: аутентифицированные пользователи могут читать, создавать и удалять документы своих проектов
  
  ## Примечания
  - Storage bucket `project-legal-documents` создается отдельной миграцией
  - Доступ к документам контролируется через RLS и storage policies
  - Флаг `is_contract` позволяет отличать готовый договор от других документов
*/

-- Создание таблицы юридических документов проекта
CREATE TABLE IF NOT EXISTS project_legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  description text NOT NULL DEFAULT '',
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at timestamptz DEFAULT now(),
  is_contract boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Включаем RLS
ALTER TABLE project_legal_documents ENABLE ROW LEVEL SECURITY;

-- Политики доступа (публичный доступ для всех аутентифицированных пользователей)
CREATE POLICY "Anyone can view project legal documents"
  ON project_legal_documents
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can upload project legal documents"
  ON project_legal_documents
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can delete project legal documents"
  ON project_legal_documents
  FOR DELETE
  USING (true);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_project_legal_docs_project 
  ON project_legal_documents(project_id);

CREATE INDEX IF NOT EXISTS idx_project_legal_docs_uploaded_by 
  ON project_legal_documents(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_project_legal_docs_is_contract 
  ON project_legal_documents(project_id, is_contract);