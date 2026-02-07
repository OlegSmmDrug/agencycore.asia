/*
  # Update minimum top-up to 5 credits

  Lowers the minimum AI credit purchase from 100 to 5 credits,
  making AI more accessible for small organizations.

  1. Modified Tables
    - `ai_platform_settings`
      - `min_topup_credits` updated from 100 to 5
*/

UPDATE ai_platform_settings
SET min_topup_credits = 5, updated_at = now()
WHERE min_topup_credits = 100;
