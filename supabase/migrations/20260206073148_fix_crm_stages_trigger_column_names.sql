/*
  # Fix CRM Pipeline Stages Trigger Function

  1. Problem
    - The `create_default_crm_stages_for_org()` trigger function references
      non-existent columns: `name` and `is_default`
    - Actual columns in `crm_pipeline_stages` are: `status_key`, `label`,
      `hint`, `level`, `color`, `sort_order`, `is_active`, `is_system`
    - This causes registration to fail when creating a new organization

  2. Fix
    - Replace the trigger function with correct column names
    - Use the same default stages as the original migration
*/

CREATE OR REPLACE FUNCTION create_default_crm_stages_for_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO crm_pipeline_stages (organization_id, status_key, label, hint, level, color, sort_order, is_active, is_system)
  VALUES
    (NEW.id, 'New Lead', 'Новый лид', 'Заполните контактные данные клиента', 0, 'border-t-4 border-slate-300', 1, true, true),
    (NEW.id, 'Contact Established', 'Установлен контакт', 'Назначьте встречу или презентацию', 1, 'border-t-4 border-blue-400', 2, true, true),
    (NEW.id, 'Presentation', 'Презентация / КП', 'Отлично! Смета готова. Сформируйте КП на основе калькулятора.', 1, 'border-t-4 border-indigo-400', 3, true, true),
    (NEW.id, 'Contract Signing', 'Подписание договора', 'Заполните юридические реквизиты для договора', 2, 'border-t-4 border-purple-400', 4, true, true),
    (NEW.id, 'In Work', 'В работе', 'Проект активен. Отслеживайте задачи и финансы.', 3, 'border-t-4 border-teal-500', 5, true, true),
    (NEW.id, 'Lost', 'Отказ / Закрыто', 'Сделка закрыта без результата', 0, 'border-t-4 border-red-400', 6, true, true)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
