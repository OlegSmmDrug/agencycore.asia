/*
  # Add FOT (Fixed Salary Fund) to Project Expenses

  1. Changes
    - Add `fot_expenses` field to track fixed salary costs
    - Add `fot_calculations` JSONB field to store breakdown by user

  2. Details
    - FOT = Fixed Base Salary / Number of Projects user is assigned to
    - Automatically calculated based on:
      * Users with base_salary in salary_schemes
      * Users assigned to project via team_ids
      * Number of active projects for each user
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_expenses' AND column_name = 'fot_expenses'
  ) THEN
    ALTER TABLE project_expenses ADD COLUMN fot_expenses numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_expenses' AND column_name = 'fot_calculations'
  ) THEN
    ALTER TABLE project_expenses ADD COLUMN fot_calculations jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;
