/*
  # Add Lead Source Information and UTM Tracking to Clients

  1. Lead Source Fields
    - `lead_source_page` - Page where the lead came from
    - `lead_source_form` - Form name that was submitted
    - `lead_source_website` - Website/source name (e.g., smmdrug.kz)
    - `lead_source_url` - Full URL of the source page

  2. UTM Parameters
    - `utm_source` - Traffic source (e.g., google, ig, facebook)
    - `utm_medium` - Marketing medium (e.g., cpc, social, email)
    - `utm_campaign` - Campaign name/ID
    - `utm_content` - Ad content identifier
    - `utm_term` - Search term for paid search

  3. Analytics Tracking IDs
    - `ymclid_metrika` - Yandex Metrika Click ID
    - `yclid_direct` - Yandex Direct Click ID
    - `gclid` - Google Click Identifier
    - `client_id_google` - Google Analytics Client ID
    - `client_id_yandex` - Yandex Metrika Client ID

  4. Description Fields Split
    - Rename `description` to `technical_description` (from calculator)
    - Add `client_brief` field (manually filled by manager)

  5. Changes
    - Add new text columns for tracking lead sources and UTM data
    - Split description into technical_description and client_brief
    - All fields are optional (nullable)
*/

-- Add lead source information fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'lead_source_page'
  ) THEN
    ALTER TABLE clients ADD COLUMN lead_source_page text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'lead_source_form'
  ) THEN
    ALTER TABLE clients ADD COLUMN lead_source_form text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'lead_source_website'
  ) THEN
    ALTER TABLE clients ADD COLUMN lead_source_website text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'lead_source_url'
  ) THEN
    ALTER TABLE clients ADD COLUMN lead_source_url text;
  END IF;
END $$;

-- Add UTM parameters
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'utm_source'
  ) THEN
    ALTER TABLE clients ADD COLUMN utm_source text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'utm_medium'
  ) THEN
    ALTER TABLE clients ADD COLUMN utm_medium text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'utm_campaign'
  ) THEN
    ALTER TABLE clients ADD COLUMN utm_campaign text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'utm_content'
  ) THEN
    ALTER TABLE clients ADD COLUMN utm_content text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'utm_term'
  ) THEN
    ALTER TABLE clients ADD COLUMN utm_term text;
  END IF;
END $$;

-- Add analytics tracking IDs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'ymclid_metrika'
  ) THEN
    ALTER TABLE clients ADD COLUMN ymclid_metrika text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'yclid_direct'
  ) THEN
    ALTER TABLE clients ADD COLUMN yclid_direct text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'gclid'
  ) THEN
    ALTER TABLE clients ADD COLUMN gclid text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'client_id_google'
  ) THEN
    ALTER TABLE clients ADD COLUMN client_id_google text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'client_id_yandex'
  ) THEN
    ALTER TABLE clients ADD COLUMN client_id_yandex text;
  END IF;
END $$;

-- Split description field into technical_description and client_brief
DO $$
BEGIN
  -- Add technical_description field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'technical_description'
  ) THEN
    ALTER TABLE clients ADD COLUMN technical_description text;
    -- Copy existing description to technical_description
    UPDATE clients SET technical_description = description WHERE description IS NOT NULL;
  END IF;

  -- Add client_brief field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'client_brief'
  ) THEN
    ALTER TABLE clients ADD COLUMN client_brief text;
  END IF;
END $$;

-- Add comment to explain the fields
COMMENT ON COLUMN clients.lead_source_page IS 'Page where the lead came from (e.g., Шаблонные страницы)';
COMMENT ON COLUMN clients.lead_source_form IS 'Form name that was submitted (e.g., Отправить набор инструментов!)';
COMMENT ON COLUMN clients.lead_source_website IS 'Website/source name (e.g., smmdrug.kz)';
COMMENT ON COLUMN clients.technical_description IS 'Technical description from service calculator';
COMMENT ON COLUMN clients.client_brief IS 'Client brief filled manually by manager';