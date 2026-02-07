/*
  # Add phone number to users

  1. Modified Tables
    - `users`
      - `phone` (text, nullable) - user's phone number for contact purposes

  2. Notes
    - Phone will be displayed in user profile settings
    - Used to auto-populate manager contacts when sharing projects with clients
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'phone'
  ) THEN
    ALTER TABLE users ADD COLUMN phone text;
  END IF;
END $$;
