/*
  # Enable Organization Isolation for Company Settings
  
  1. Security Changes
    - Enable RLS on `company_settings` table
    - Add organization-based isolation policies
    - Users can only see/modify company settings for their own organization
  
  2. Policies Created
    - SELECT: Users can read company settings only from their organization
    - INSERT: Users can create company settings only for their organization
    - UPDATE: Users can update company settings only for their organization
    - DELETE: Users can delete company settings only for their organization
  
  3. Important Notes
    - This ensures complete data isolation between organizations
    - Each organization can only access their own company information
    - No cross-organization data leakage is possible
*/

-- Enable RLS for company_settings
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT: Users can only read company settings from their organization
CREATE POLICY "Users can view own organization company settings"
  ON company_settings
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM users 
      WHERE id = (SELECT id FROM users WHERE email = current_user LIMIT 1)
    )
  );

-- Policy for INSERT: Users can only create company settings for their organization
CREATE POLICY "Users can insert own organization company settings"
  ON company_settings
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM users 
      WHERE id = (SELECT id FROM users WHERE email = current_user LIMIT 1)
    )
  );

-- Policy for UPDATE: Users can only update company settings for their organization
CREATE POLICY "Users can update own organization company settings"
  ON company_settings
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM users 
      WHERE id = (SELECT id FROM users WHERE email = current_user LIMIT 1)
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM users 
      WHERE id = (SELECT id FROM users WHERE email = current_user LIMIT 1)
    )
  );

-- Policy for DELETE: Users can only delete company settings for their organization
CREATE POLICY "Users can delete own organization company settings"
  ON company_settings
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM users 
      WHERE id = (SELECT id FROM users WHERE email = current_user LIMIT 1)
    )
  );
