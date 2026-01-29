/*
  # Setup Supabase Auth Integration

  ## Overview
  This migration integrates Supabase Authentication with our custom users table.
  It creates a bridge between auth.users (Supabase Auth) and public.users (our app).

  ## Changes
  1. Add auth_id column to public.users to link with auth.users
  2. Create trigger to auto-create public.users record on signup
  3. Create function to sync user metadata
  4. Update helper functions to use auth.uid()
  5. Add user_profiles view for easier access

  ## Strategy
  - Existing users will be migrated to Supabase Auth later (manual process)
  - New registrations will automatically create both auth.users and public.users
  - auth.uid() will be the source of truth for user identity
*/

-- Add auth_id column to users table (links to auth.users)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'auth_id'
  ) THEN
    ALTER TABLE users ADD COLUMN auth_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
  END IF;
END $$;

-- Function to handle new user signup
-- This creates a public.users record when someone signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  default_org_id uuid;
  user_full_name text;
  user_role text;
BEGIN
  -- Extract metadata from auth.users
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  user_role := COALESCE(NEW.raw_user_meta_data->>'system_role', 'Member');
  
  -- Get organization_id from metadata (set during signup)
  -- If not set, this will be NULL and user needs to create/join organization
  default_org_id := (NEW.raw_user_meta_data->>'organization_id')::uuid;

  -- Create public.users record
  INSERT INTO public.users (
    id,
    auth_id,
    name,
    email,
    organization_id,
    system_role,
    avatar,
    created_at
  ) VALUES (
    gen_random_uuid(),
    NEW.id,
    user_full_name,
    NEW.email,
    default_org_id,
    user_role,
    NEW.raw_user_meta_data->>'avatar',
    now()
  );

  RETURN NEW;
END;
$$;

-- Trigger to automatically create public.users on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to sync user metadata from auth.users to public.users
CREATE OR REPLACE FUNCTION public.sync_user_metadata()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update public.users when auth.users email or metadata changes
  UPDATE public.users
  SET 
    email = NEW.email,
    name = COALESCE(NEW.raw_user_meta_data->>'full_name', name),
    avatar = COALESCE(NEW.raw_user_meta_data->>'avatar', avatar)
  WHERE auth_id = NEW.id;

  RETURN NEW;
END;
$$;

-- Trigger to sync metadata changes
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_metadata();

-- Update get_current_user_organization_id to use auth.uid()
CREATE OR REPLACE FUNCTION get_current_user_organization_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  org_id uuid;
BEGIN
  -- First try to get from auth.uid() (new way)
  IF auth.uid() IS NOT NULL THEN
    SELECT organization_id INTO org_id
    FROM users
    WHERE auth_id = auth.uid();
    
    RETURN org_id;
  END IF;

  -- Fallback for legacy users (will be removed after full migration)
  SELECT organization_id INTO org_id
  FROM users
  WHERE id = auth.uid();
  
  RETURN org_id;
END;
$$;

-- Update is_super_admin to use auth.uid()
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role text;
BEGIN
  -- Check via auth.uid()
  SELECT system_role INTO user_role
  FROM users
  WHERE auth_id = auth.uid() OR id = auth.uid();
  
  RETURN user_role = 'Admin';
END;
$$;

-- Create a view for easier user profile access
CREATE OR REPLACE VIEW user_profiles AS
SELECT 
  u.id,
  u.auth_id,
  u.name,
  u.email,
  u.system_role,
  u.organization_id,
  u.avatar,
  u.job_title,
  u.created_at,
  o.name as organization_name,
  o.slug as organization_slug
FROM users u
LEFT JOIN organizations o ON u.organization_id = o.id;

-- Grant access to the view
GRANT SELECT ON user_profiles TO authenticated, anon;

-- Enable Row Level Security on user_profiles view
ALTER VIEW user_profiles SET (security_invoker = true);

-- Function to get current user profile
CREATE OR REPLACE FUNCTION get_current_user_profile()
RETURNS TABLE (
  id uuid,
  auth_id uuid,
  name text,
  email text,
  system_role text,
  organization_id uuid,
  organization_name text,
  organization_slug text,
  job_title text,
  avatar text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.auth_id,
    u.name,
    u.email,
    u.system_role,
    u.organization_id,
    o.name as organization_name,
    o.slug as organization_slug,
    u.job_title,
    u.avatar
  FROM users u
  LEFT JOIN organizations o ON u.organization_id = o.id
  WHERE u.auth_id = auth.uid();
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_current_user_profile() TO authenticated, anon;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth_id_org ON users(auth_id, organization_id);

-- Add comment explaining the migration strategy
COMMENT ON COLUMN users.auth_id IS 'Links to auth.users(id). NULL for legacy users not yet migrated to Supabase Auth.';
COMMENT ON COLUMN users.password IS 'Deprecated. Only used for legacy users. Will be removed after full migration to Supabase Auth.';
