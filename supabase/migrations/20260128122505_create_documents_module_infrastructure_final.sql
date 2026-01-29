/*
  # Create Documents Module Infrastructure

  1. New Tables
    - `executor_companies` - Company information for document generation
    - `payment_type_options` - Predefined payment terms templates  
    - `document_templates` - Stores .docx templates with parsed variables
    - `generated_documents` - Stores generated documents
  
  2. Storage Buckets
    - `document-templates` - for .docx template files
    - `generated-documents` - for generated .docx and .pdf files
  
  3. Seed Data
    - Default executor company (SMM DRUG)
    - Common payment type options
*/

-- Executor Companies Table
CREATE TABLE IF NOT EXISTS executor_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  short_name text NOT NULL,
  legal_name text NOT NULL,
  bin text NOT NULL,
  
  phone text,
  email text,
  website text,
  
  reg_address text,
  legal_address text,
  
  director_name text NOT NULL,
  director_position text NOT NULL,
  authority_basis text,
  
  bank_name text,
  iban text,
  bik text,
  
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_executor_companies_org ON executor_companies(organization_id);

-- Payment Type Options Table
CREATE TABLE IF NOT EXISTS payment_type_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  
  name text NOT NULL,
  legal_text text NOT NULL,
  order_index integer DEFAULT 0,
  
  is_global boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_types_org ON payment_type_options(organization_id);

-- Document Templates Table
CREATE TABLE IF NOT EXISTS document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  name text NOT NULL,
  category text DEFAULT 'contract',
  description text,
  
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  
  parsed_variables jsonb DEFAULT '[]'::jsonb,
  
  usage_count integer DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_templates_org ON document_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_category ON document_templates(category);

-- Generated Documents Table
CREATE TABLE IF NOT EXISTS generated_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  template_id uuid REFERENCES document_templates(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  
  document_number text,
  name text NOT NULL,
  
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'sent', 'signed', 'cancelled')),
  
  amount numeric(15, 2),
  currency text DEFAULT 'KZT',
  
  variables_used jsonb DEFAULT '{}'::jsonb,
  
  notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  signed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_generated_documents_org ON generated_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_client ON generated_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_project ON generated_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_template ON generated_documents(template_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_status ON generated_documents(status);

-- Storage Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('document-templates', 'document-templates', false, 52428800, ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]),
  ('generated-documents', 'generated-documents', false, 52428800, ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf']::text[])
ON CONFLICT (id) DO NOTHING;

-- Seed global payment type options
INSERT INTO payment_type_options (id, organization_id, name, legal_text, order_index, is_global)
VALUES
  (gen_random_uuid(), NULL, '100% предоплата', 'Оплата производится в размере 100% от общей суммы договора в течение 3 (трех) банковских дней с момента подписания настоящего договора.', 1, true),
  (gen_random_uuid(), NULL, '50% предоплата / 50% постоплата', 'Оплата производится в два этапа: 50% (пятьдесят процентов) от общей суммы договора в качестве предоплаты в течение 3 (трех) банковских дней с момента подписания настоящего договора; оставшиеся 50% (пятьдесят процентов) в течение 5 (пяти) банковских дней после подписания акта выполненных работ.', 2, true),
  (gen_random_uuid(), NULL, '30% предоплата / 70% постоплата', 'Оплата производится в два этапа: 30% (тридцать процентов) от общей суммы договора в качестве предоплаты в течение 3 (трех) банковских дней с момента подписания настоящего договора; оставшиеся 70% (семьдесят процентов) в течение 5 (пяти) банковских дней после подписания акта выполненных работ.', 3, true),
  (gen_random_uuid(), NULL, '100% постоплата', 'Оплата производится в размере 100% от общей суммы договора в течение 5 (пяти) банковских дней после подписания акта выполненных работ.', 4, true),
  (gen_random_uuid(), NULL, 'Помесячная оплата', 'Оплата производится ежемесячно равными частями в размере, указанном в приложении к настоящему договору, до 10 (десятого) числа текущего месяца.', 5, true)
ON CONFLICT DO NOTHING;

-- Seed default executor company
DO $$
DECLARE
  legacy_org_id uuid;
BEGIN
  SELECT id INTO legacy_org_id FROM organizations WHERE name = 'Legacy Organization' LIMIT 1;
  
  IF legacy_org_id IS NOT NULL THEN
    INSERT INTO executor_companies (
      organization_id,
      short_name,
      legal_name,
      bin,
      phone,
      email,
      website,
      reg_address,
      legal_address,
      director_name,
      director_position,
      authority_basis,
      bank_name,
      iban,
      bik,
      is_default
    ) VALUES (
      legacy_org_id,
      'SMM DRUG',
      'ИП «SMM DRUG»',
      '000527501224',
      '8 (707) 521 05 65',
      'smmdrug@gmail.com',
      'www.smmdrug.kz',
      'г.Алматы, Бостандыкский район, мкр. Алмагуль, 27',
      'г.Алматы, Бостандыкский район, мкр. Алмагуль, 27',
      'Маликов Олег Михаилович',
      'Индивидуальный предприниматель',
      'Уведомление о начале деятельности в качестве ИП №KZ63UWQ02328414',
      'АО "Банк Центр Кредит"',
      'KZ448562204110732118',
      'KCJBKZKX',
      true
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Function to auto-increment document numbers
CREATE OR REPLACE FUNCTION generate_document_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  doc_count integer;
  year_suffix text;
BEGIN
  IF NEW.document_number IS NULL THEN
    SELECT COUNT(*) INTO doc_count
    FROM generated_documents
    WHERE organization_id = NEW.organization_id
      AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    
    year_suffix := EXTRACT(YEAR FROM NOW())::text;
    NEW.document_number := 'DOC-' || year_suffix || '-' || LPAD((doc_count + 1)::text, 4, '0');
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS generate_document_number_trigger ON generated_documents;
CREATE TRIGGER generate_document_number_trigger
  BEFORE INSERT ON generated_documents
  FOR EACH ROW
  EXECUTE FUNCTION generate_document_number();

-- Function to increment template usage
CREATE OR REPLACE FUNCTION increment_template_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.template_id IS NOT NULL THEN
    UPDATE document_templates
    SET usage_count = usage_count + 1
    WHERE id = NEW.template_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS increment_template_usage_trigger ON generated_documents;
CREATE TRIGGER increment_template_usage_trigger
  AFTER INSERT ON generated_documents
  FOR EACH ROW
  EXECUTE FUNCTION increment_template_usage();

-- Add Documents module
INSERT INTO platform_modules (slug, name, description, icon, sort_order, is_active)
VALUES ('documents', 'Документы', 'Генерация договоров, КП и счетов', '📄', 60, true)
ON CONFLICT (slug) DO NOTHING;