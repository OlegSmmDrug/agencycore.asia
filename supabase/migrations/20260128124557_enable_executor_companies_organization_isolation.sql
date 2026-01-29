/*
  # Enable Organization Isolation for Executor Companies
  
  1. Security Changes
    - Enable RLS on `executor_companies` table
    - Add organization-based isolation policies
    - Users can only see/modify executor companies for their own organization
  
  2. Policies Created
    - SELECT: Users can read executor companies only from their organization
    - INSERT: Users can create executor companies only for their organization
    - UPDATE: Users can update executor companies only for their organization
    - DELETE: Users can delete executor companies only for their organization
  
  3. Important Notes
    - This ensures complete data isolation between organizations
    - Each organization can only access their own executor company information
    - No cross-organization data leakage is possible
*/

-- Enable RLS for executor_companies
ALTER TABLE executor_companies ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT: Users can only read executor companies from their organization
CREATE POLICY "Users can view own organization executor companies"
  ON executor_companies
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM users 
      WHERE id = (SELECT id FROM users WHERE email = current_user LIMIT 1)
    )
  );

-- Policy for INSERT: Users can only create executor companies for their organization
CREATE POLICY "Users can insert own organization executor companies"
  ON executor_companies
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM users 
      WHERE id = (SELECT id FROM users WHERE email = current_user LIMIT 1)
    )
  );

-- Policy for UPDATE: Users can only update executor companies for their organization
CREATE POLICY "Users can update own organization executor companies"
  ON executor_companies
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

-- Policy for DELETE: Users can only delete executor companies for their organization
CREATE POLICY "Users can delete own organization executor companies"
  ON executor_companies
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM users 
      WHERE id = (SELECT id FROM users WHERE email = current_user LIMIT 1)
    )
  );
