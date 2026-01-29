/*
  # Storage bucket для юридических документов проектов

  ## Описание
  Создание storage bucket для хранения юридических документов (договоров, актов, счетов и т.д.)

  ## Storage Bucket
  - Название: `project-legal-documents`
  - Публичный доступ: false (файлы доступны только через авторизацию)
  - Допустимые типы файлов: PDF, DOCX, DOC, XLS, XLSX и изображения
  - Максимальный размер файла: 50 МБ

  ## Политики доступа
  - Все аутентифицированные пользователи могут загружать файлы
  - Все аутентифицированные пользователи могут читать файлы
  - Все аутентифицированные пользователи могут удалять файлы
*/

-- Создаем bucket для юридических документов проектов
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-legal-documents', 'project-legal-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Удаляем старые политики если они есть
DROP POLICY IF EXISTS "Anyone can upload legal documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view legal documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete legal documents" ON storage.objects;

-- Политика: все могут загружать документы
CREATE POLICY "Anyone can upload legal documents"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'project-legal-documents');

-- Политика: все могут читать документы
CREATE POLICY "Anyone can view legal documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'project-legal-documents');

-- Политика: все могут удалять документы
CREATE POLICY "Anyone can delete legal documents"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'project-legal-documents');