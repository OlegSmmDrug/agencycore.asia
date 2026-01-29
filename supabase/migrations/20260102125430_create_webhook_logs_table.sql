/*
  # Create webhook logs table
  
  1. New Tables
    - `webhook_logs` - stores all incoming webhook requests for debugging
      - `id` (uuid, primary key)
      - `source` (text) - webhook source (creatium, wazzup, etc)
      - `method` (text) - HTTP method
      - `headers` (jsonb) - request headers
      - `body` (text) - raw request body
      - `parsed_data` (jsonb) - parsed data
      - `result` (text) - success/error
      - `error_message` (text) - error details if any
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS with public access for insert (webhooks need to write)
*/

CREATE TABLE IF NOT EXISTS webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  method text,
  headers jsonb,
  body text,
  parsed_data jsonb,
  result text,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert on webhook_logs"
  ON webhook_logs FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public select on webhook_logs"
  ON webhook_logs FOR SELECT
  TO public
  USING (true);