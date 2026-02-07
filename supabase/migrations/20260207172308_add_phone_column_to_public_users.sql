/*
  # Add phone column to public.users table

  1. Modified Tables
    - `public.users`
      - `phone` (text, nullable) - user's phone number

  2. Notes
    - Explicitly targets public.users (not auth.users)
    - Used in profile settings and auto-populates manager contacts when sharing projects
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.users ADD COLUMN phone text;
  END IF;
END $$;
