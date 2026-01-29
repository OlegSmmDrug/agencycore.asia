/*
  # Create Executor Company Info Table

  1. New Tables
    - `executor_company_info`
      - `id` (uuid, primary key) - unique identifier
      - `legal_name` (text) - Legal company name (e.g., ИП «SMM DRUG»)
      - `short_name` (text) - Short company name
      - `bin` (text) - BIN/IIN number
      - `address` (text) - Registration address
      - `legal_address` (text) - Legal address
      - `director` (text) - Director full name
      - `director_position` (text) - Director position title
      - `director_basis` (text) - Basis for authority (e.g., Устава)
      - `bank` (text) - Bank name
      - `iban` (text) - Bank account IBAN
      - `bik` (text) - Bank identification code
      - `phone` (text) - Contact phone number
      - `email` (text) - Contact email
      - `website` (text) - Company website
      - `is_active` (boolean) - Whether this is the active company info
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
      - `updated_by` (uuid) - User who last updated

  2. Security
    - Enable RLS on `executor_company_info` table
    - Add policies for authenticated users to read company info
    - Add policies for authenticated users to update company info

  3. Data
    - Insert default company info for SMM DRUG
*/

CREATE TABLE IF NOT EXISTS executor_company_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL DEFAULT '',
  short_name text NOT NULL DEFAULT '',
  bin text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  legal_address text NOT NULL DEFAULT '',
  director text NOT NULL DEFAULT '',
  director_position text NOT NULL DEFAULT 'Директор',
  director_basis text NOT NULL DEFAULT 'Устава',
  bank text NOT NULL DEFAULT '',
  iban text NOT NULL DEFAULT '',
  bik text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  website text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

ALTER TABLE executor_company_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active executor company info"
  ON executor_company_info
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert executor company info"
  ON executor_company_info
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update executor company info"
  ON executor_company_info
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete executor company info"
  ON executor_company_info
  FOR DELETE
  TO authenticated
  USING (true);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_executor_company_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER executor_company_info_updated_at
  BEFORE UPDATE ON executor_company_info
  FOR EACH ROW
  EXECUTE FUNCTION update_executor_company_info_updated_at();

-- Insert default SMM DRUG company info
INSERT INTO executor_company_info (
  legal_name,
  short_name,
  bin,
  address,
  legal_address,
  director,
  director_position,
  director_basis,
  bank,
  iban,
  bik,
  phone,
  email,
  website,
  is_active
) VALUES (
  'ИП «SMM DRUG»',
  'SMM DRUG',
  '000527501224',
  'г.Алматы, Бостандыкский район, мкр. Алмагуль, 27',
  'г.Алматы, Бостандыкский район, мкр. Алмагуль, 27',
  'Маликов Олег Михаилович',
  'Директор',
  'Устава',
  'АО "Jusan Bank"',
  'KZ448562204110732118',
  'KCJBKZKX',
  '8 (707) 521 05 65',
  'smmdrug@gmail.com',
  '',
  true
);