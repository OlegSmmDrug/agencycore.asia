/*
  # Add increment template usage function

  1. New Functions
    - `increment_template_usage` - Atomically increments usage_count for a template
  
  2. Purpose
    - Provides safe concurrent incrementing of template usage statistics
*/

CREATE OR REPLACE FUNCTION increment_template_usage(template_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE contract_templates
  SET usage_count = usage_count + 1
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;