/*
  # Fix Function Search Paths for Security

  1. Security Improvements
    - Sets secure search_path for all functions
    - Prevents SQL injection attacks via search_path manipulation
    - Uses 'public, pg_temp' which is the recommended secure pattern

  2. Functions Affected (24 total)
    - complete_level2_stage, has_organization_access
    - get_organization_subscription, increment_usage_metric
    - reset_usage_metric, is_organization_blocked
    - is_subscription_active, get_current_user_profile
    - update_contract_updated_at, is_guest_authorized
    - increment_template_usage, log_guest_activity
    - update_updated_at_column, update_executor_company_info_updated_at
    - update_project_expenses_updated_at, check_stage_tasks_completed
    - activate_next_stage, start_level2_stage
    - complete_level1_stage, check_feature_access
    - check_usage_limit, get_current_user_organization_id
    - is_super_admin, get_current_user_id
*/

-- Set secure search_path for all functions
ALTER FUNCTION complete_level2_stage SET search_path = public, pg_temp;
ALTER FUNCTION has_organization_access SET search_path = public, pg_temp;
ALTER FUNCTION get_organization_subscription SET search_path = public, pg_temp;
ALTER FUNCTION increment_usage_metric SET search_path = public, pg_temp;
ALTER FUNCTION reset_usage_metric SET search_path = public, pg_temp;
ALTER FUNCTION is_organization_blocked SET search_path = public, pg_temp;
ALTER FUNCTION is_subscription_active SET search_path = public, pg_temp;
ALTER FUNCTION get_current_user_profile SET search_path = public, pg_temp;
ALTER FUNCTION update_contract_updated_at SET search_path = public, pg_temp;
ALTER FUNCTION is_guest_authorized SET search_path = public, pg_temp;
ALTER FUNCTION increment_template_usage SET search_path = public, pg_temp;
ALTER FUNCTION log_guest_activity SET search_path = public, pg_temp;
ALTER FUNCTION update_updated_at_column SET search_path = public, pg_temp;
ALTER FUNCTION update_executor_company_info_updated_at SET search_path = public, pg_temp;
ALTER FUNCTION update_project_expenses_updated_at SET search_path = public, pg_temp;
ALTER FUNCTION check_stage_tasks_completed SET search_path = public, pg_temp;
ALTER FUNCTION activate_next_stage SET search_path = public, pg_temp;
ALTER FUNCTION start_level2_stage SET search_path = public, pg_temp;
ALTER FUNCTION complete_level1_stage SET search_path = public, pg_temp;
ALTER FUNCTION check_feature_access SET search_path = public, pg_temp;
ALTER FUNCTION check_usage_limit SET search_path = public, pg_temp;
ALTER FUNCTION get_current_user_organization_id SET search_path = public, pg_temp;
ALTER FUNCTION is_super_admin SET search_path = public, pg_temp;
ALTER FUNCTION get_current_user_id SET search_path = public, pg_temp;