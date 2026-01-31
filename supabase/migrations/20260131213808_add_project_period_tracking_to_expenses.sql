/*
  # Add Project Period Tracking to Expenses

  1. Changes
    - Add `project_month_number` field to track "Первый месяц", "Второй месяц" etc
    - Add `period_start_date` to track actual start of expense period
    - Add `period_end_date` to track actual end of expense period
    - Keep `month` field for backward compatibility
    
  2. Migration Strategy
    - Add new fields with nullable constraints
    - Create helper function to calculate project periods
    - Migrate existing data based on project start dates
    
  3. Notes
    - Projects now track expenses by project months (1, 2, 3...) not calendar months
    - Each period is 30 days from project start
    - "Продлить текущий (+30 дней)" extends by adding new period
*/

-- Add new fields for project period tracking
ALTER TABLE project_expenses 
ADD COLUMN IF NOT EXISTS project_month_number INTEGER,
ADD COLUMN IF NOT EXISTS period_start_date DATE,
ADD COLUMN IF NOT EXISTS period_end_date DATE;

-- Create function to calculate project period dates
CREATE OR REPLACE FUNCTION calculate_project_period(
  p_project_start_date DATE,
  p_month_number INTEGER
) RETURNS TABLE(start_date DATE, end_date DATE) AS $$
BEGIN
  -- Each period is 30 days
  -- Month 1: start_date + 0 to start_date + 29
  -- Month 2: start_date + 30 to start_date + 59
  -- Month 3: start_date + 60 to start_date + 89
  RETURN QUERY
  SELECT 
    (p_project_start_date + ((p_month_number - 1) * 30))::DATE AS start_date,
    (p_project_start_date + ((p_month_number - 1) * 30) + 29)::DATE AS end_date;
END;
$$ LANGUAGE plpgsql STABLE;

-- Migrate existing data to use project periods
-- This assigns month numbers based on calendar month distance from project start
DO $$
DECLARE
  expense_rec RECORD;
  project_start DATE;
  expense_month_date DATE;
  month_diff INTEGER;
BEGIN
  FOR expense_rec IN 
    SELECT pe.id, pe.project_id, pe.month, p.start_date as project_start_date
    FROM project_expenses pe
    JOIN projects p ON pe.project_id = p.id
    WHERE pe.project_month_number IS NULL
      AND p.start_date IS NOT NULL
  LOOP
    project_start := expense_rec.project_start_date::DATE;
    expense_month_date := (expense_rec.month || '-01')::DATE;
    
    -- Calculate which project month this calendar month represents
    -- This is approximate - we'll use calendar months for migration
    month_diff := EXTRACT(YEAR FROM AGE(expense_month_date, project_start)) * 12 
                + EXTRACT(MONTH FROM AGE(expense_month_date, project_start));
    
    -- Ensure minimum month number is 1
    IF month_diff < 0 THEN
      month_diff := 0;
    END IF;
    
    -- Update with calculated project month
    UPDATE project_expenses
    SET 
      project_month_number = month_diff + 1,
      period_start_date = (SELECT start_date FROM calculate_project_period(project_start, month_diff + 1)),
      period_end_date = (SELECT end_date FROM calculate_project_period(project_start, month_diff + 1))
    WHERE id = expense_rec.id;
  END LOOP;
END $$;

-- For expenses without project start date, default to month 1
UPDATE project_expenses
SET 
  project_month_number = 1,
  period_start_date = (month || '-01')::DATE,
  period_end_date = (month || '-01')::DATE + 29
WHERE project_month_number IS NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_expenses_month_number 
ON project_expenses(project_id, project_month_number);

-- Add comment for documentation
COMMENT ON COLUMN project_expenses.project_month_number IS 'Project month number (1 = first month, 2 = second month, etc). Each month is 30 days from project start.';
COMMENT ON COLUMN project_expenses.period_start_date IS 'Start date of expense period (calculated as project_start + (month_number-1)*30 days)';
COMMENT ON COLUMN project_expenses.period_end_date IS 'End date of expense period (calculated as period_start + 29 days)';