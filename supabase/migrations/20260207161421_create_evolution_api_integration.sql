/*
  # Интеграция Evolution API для WhatsApp

  Создание инфраструктуры для бесплатного WhatsApp через собственный Evolution API сервер.

  1. Новые таблицы:
    - `evolution_instances` - WhatsApp инстансы для каждой организации
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK -> organizations)
      - `instance_name` (text) - уникальное имя инстанса в Evolution API
      - `phone_number` (text) - привязанный номер телефона
      - `connection_status` (text) - статус подключения
      - `qr_code` (text) - QR-код в base64
      - `qr_code_updated_at` (timestamptz)
      - `webhook_configured` (boolean)
      - `last_connected_at` (timestamptz)
      - `error_message` (text)
    - `evolution_settings` - глобальные настройки сервера Evolution API
      - `id` (uuid, primary key)
      - `server_url` (text) - URL сервера
      - `api_key` (text) - мастер API ключ
      - `is_active` (boolean)
      - `health_status` (text)
      - `last_health_check` (timestamptz)

  2. Изменения существующих таблиц:
    - `whatsapp_messages` - добавлено поле `provider_type`
    - `whatsapp_chats` - добавлено поле `provider_type`

  3. Безопасность:
    - RLS не включен (прототип, будет включен позже)
*/

CREATE TABLE IF NOT EXISTS evolution_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  instance_name text NOT NULL,
  phone_number text,
  connection_status text DEFAULT 'disconnected' CHECK (connection_status IN ('disconnected', 'connecting', 'open', 'close', 'qr')),
  qr_code text,
  qr_code_updated_at timestamptz,
  webhook_configured boolean DEFAULT false,
  last_connected_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, instance_name)
);

CREATE INDEX IF NOT EXISTS idx_evolution_instances_org ON evolution_instances(organization_id);
CREATE INDEX IF NOT EXISTS idx_evolution_instances_status ON evolution_instances(connection_status);

CREATE TABLE IF NOT EXISTS evolution_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_url text NOT NULL,
  api_key text NOT NULL,
  is_active boolean DEFAULT true,
  health_status text DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'unhealthy', 'unknown')),
  last_health_check timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'provider_type'
  ) THEN
    ALTER TABLE whatsapp_messages
    ADD COLUMN provider_type text CHECK (provider_type IN ('greenapi', 'wazzup', 'evolution'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_chats' AND column_name = 'provider_type'
  ) THEN
    ALTER TABLE whatsapp_chats
    ADD COLUMN provider_type text CHECK (provider_type IN ('greenapi', 'wazzup', 'evolution'));
  END IF;
END $$;
