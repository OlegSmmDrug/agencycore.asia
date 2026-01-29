/*
  # Add Password Authentication to Users

  1. Changes
    - Add `password` column to users table for login authentication
    - Set default password '123456' for all existing users
  
  2. Security Notes
    - Passwords stored as plain text for simplicity (demo purposes)
    - In production, use proper hashing (bcrypt, argon2)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'password'
  ) THEN
    ALTER TABLE public.users ADD COLUMN password text DEFAULT '123456';
  END IF;
END $$;

UPDATE public.users SET password = '123456' WHERE password IS NULL;