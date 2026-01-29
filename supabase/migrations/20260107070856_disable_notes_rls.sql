/*
  # Temporarily disable RLS for notes table
  
  1. Changes
    - Disable Row Level Security on notes table
    - This allows the application to manage notes without auth.uid() checks
    - Notes access will be controlled at the application level
  
  2. Security
    - RLS disabled temporarily until proper authentication is implemented
    - Application-level checks ensure users only see their own notes
*/

ALTER TABLE notes DISABLE ROW LEVEL SECURITY;
