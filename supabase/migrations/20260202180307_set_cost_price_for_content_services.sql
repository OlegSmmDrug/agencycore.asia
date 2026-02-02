/*
  # Set Cost Price for Content Services
  
  ## Summary
  Updates calculator_services to set cost_price based on salary scheme rates.
  Cost price represents the actual payment to SMM specialist per content unit.
  
  ## Changes
  1. Post: cost_price = 800 (from salary_schemes kpi_rules)
  2. Stories: cost_price = 500 (from salary_schemes kpi_rules)
  3. Reels: cost_price = 800 (from salary_schemes kpi_rules)
  
  ## Notes
  - These values match the KPI rules in salary_schemes for SMM specialists
  - This ensures consistency between expense calculations and payroll
*/

UPDATE calculator_services 
SET cost_price = 800 
WHERE name = 'Post' AND (cost_price IS NULL OR cost_price = 0);

UPDATE calculator_services 
SET cost_price = 500 
WHERE name = 'Stories' AND (cost_price IS NULL OR cost_price = 0);

UPDATE calculator_services 
SET cost_price = 800 
WHERE name = 'Reels' AND (cost_price IS NULL OR cost_price = 0);

-- Also set cost_price for other SMM services if not set (use 50% of price as default)
UPDATE calculator_services 
SET cost_price = ROUND(price::numeric * 0.5)
WHERE category = 'smm' 
AND (cost_price IS NULL OR cost_price = 0)
AND name NOT IN ('Post', 'Stories', 'Reels');