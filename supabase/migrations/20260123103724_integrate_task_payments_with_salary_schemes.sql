/*
  # Интеграция автоматической оплаты задач со схемами ЗП

  ## Описание
  Обновляет систему автоматического начисления оплаты при завершении задач.
  Теперь используется существующая таблица salary_schemes вместо отдельной task_type_rates.

  ## Изменения
  
  1. Обновлена функция `process_completed_task()`:
     - Берет ставки из salary_schemes.kpi_rules
     - Ищет схему по должности исполнителя (target_type='jobTitle')
     - Извлекает ставку для типа задачи из jsonb массива
  
  2. Удалена таблица `task_type_rates` (больше не используется)
  
  ## Логика работы
  При завершении задачи:
  1. Получает должность исполнителя из users.job_title
  2. Находит схему ЗП для этой должности
  3. Извлекает ставку для типа задачи из kpi_rules
  4. Рассчитывает сумму (ставка × часы)
  5. Добавляет оплату в payroll_records.task_payments
  6. Если задача привязана к проекту - обновляет project_expenses
*/

-- Удаляем старую таблицу ставок
DROP TABLE IF EXISTS task_type_rates CASCADE;

-- Обновляем функцию обработки завершенных задач
CREATE OR REPLACE FUNCTION process_completed_task()
RETURNS TRIGGER AS $$
DECLARE
  v_user_job_title text;
  v_rate numeric;
  v_hours numeric;
  v_amount numeric;
  v_month text;
  v_payroll_record payroll_records;
  v_task_payment jsonb;
  v_project_expenses project_expenses;
  v_kpi_rules jsonb;
  v_rule jsonb;
BEGIN
  -- Проверяем, что задача перешла в статус Done
  IF NEW.status = 'Done' AND (OLD.status IS NULL OR OLD.status != 'Done') THEN
    
    -- Проверяем, что у задачи есть исполнитель
    IF NEW.assignee_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Получаем должность исполнителя
    SELECT job_title INTO v_user_job_title
    FROM users
    WHERE id = NEW.assignee_id;

    IF v_user_job_title IS NULL THEN
      RETURN NEW;
    END IF;

    -- Получаем kpi_rules из схемы ЗП для этой должности
    SELECT kpi_rules INTO v_kpi_rules
    FROM salary_schemes
    WHERE organization_id = NEW.organization_id
      AND target_type = 'jobTitle'
      AND target_id = v_user_job_title
    LIMIT 1;

    -- Если схема не найдена, завершаем обработку
    IF v_kpi_rules IS NULL THEN
      RETURN NEW;
    END IF;

    -- Ищем ставку для типа задачи в массиве kpi_rules
    v_rate := NULL;
    FOR v_rule IN SELECT * FROM jsonb_array_elements(v_kpi_rules)
    LOOP
      IF v_rule->>'taskType' = NEW.type THEN
        v_rate := (v_rule->>'value')::numeric;
        EXIT;
      END IF;
    END LOOP;

    -- Если ставка не найдена или равна 0, завершаем обработку
    IF v_rate IS NULL OR v_rate = 0 THEN
      RETURN NEW;
    END IF;

    -- Определяем количество часов (берем из estimated_hours или по умолчанию 1)
    v_hours := COALESCE(NEW.estimated_hours, 1);
    v_amount := v_rate * v_hours;

    -- Определяем месяц для расчета зарплаты
    v_month := to_char(COALESCE(NEW.completed_at, now()), 'YYYY-MM');

    -- Ищем или создаем запись в payroll_records
    SELECT * INTO v_payroll_record
    FROM payroll_records
    WHERE user_id = NEW.assignee_id
      AND month = v_month
      AND organization_id = NEW.organization_id;

    -- Формируем объект оплаты за задачу
    v_task_payment := jsonb_build_object(
      'task_id', NEW.id,
      'task_title', NEW.title,
      'task_type', NEW.type,
      'hours', v_hours,
      'rate', v_rate,
      'amount', v_amount,
      'completed_at', COALESCE(NEW.completed_at, now())
    );

    IF v_payroll_record.id IS NULL THEN
      -- Создаем новую запись
      INSERT INTO payroll_records (
        user_id,
        month,
        organization_id,
        calculated_kpi,
        task_payments,
        status
      ) VALUES (
        NEW.assignee_id,
        v_month,
        NEW.organization_id,
        v_amount,
        jsonb_build_array(v_task_payment),
        'draft'
      );
    ELSE
      -- Обновляем существующую запись
      UPDATE payroll_records
      SET 
        calculated_kpi = COALESCE(calculated_kpi, 0) + v_amount,
        task_payments = COALESCE(task_payments, '[]'::jsonb) || v_task_payment,
        updated_at = now()
      WHERE id = v_payroll_record.id;
    END IF;

    -- Если задача привязана к проекту, обновляем расходы проекта
    IF NEW.project_id IS NOT NULL THEN
      -- Ищем или создаем запись расходов проекта
      SELECT * INTO v_project_expenses
      FROM project_expenses
      WHERE project_id = NEW.project_id
        AND month = v_month;

      IF v_project_expenses.id IS NULL THEN
        -- Создаем новую запись расходов
        INSERT INTO project_expenses (
          project_id,
          month,
          organization_id,
          production_expenses
        ) VALUES (
          NEW.project_id,
          v_month,
          NEW.organization_id,
          v_amount
        );
      ELSE
        -- Обновляем существующую запись в зависимости от должности
        CASE v_user_job_title
          WHEN 'Mobilograph / Мобилограф' THEN
            UPDATE project_expenses
            SET 
              production_mobilograph_hours = COALESCE(production_mobilograph_hours, 0) + v_hours,
              production_expenses = COALESCE(production_expenses, 0) + v_amount,
              updated_at = now()
            WHERE id = v_project_expenses.id;
          
          WHEN 'Photographer / Фотограф' THEN
            UPDATE project_expenses
            SET 
              production_photographer_hours = COALESCE(production_photographer_hours, 0) + v_hours,
              production_expenses = COALESCE(production_expenses, 0) + v_amount,
              updated_at = now()
            WHERE id = v_project_expenses.id;
          
          WHEN 'Videographer / Видеограф' THEN
            UPDATE project_expenses
            SET 
              production_videographer_hours = COALESCE(production_videographer_hours, 0) + v_hours,
              production_expenses = COALESCE(production_expenses, 0) + v_amount,
              updated_at = now()
            WHERE id = v_project_expenses.id;
          
          ELSE
            -- Для остальных должностей просто добавляем в production_expenses
            UPDATE project_expenses
            SET 
              production_expenses = COALESCE(production_expenses, 0) + v_amount,
              updated_at = now()
            WHERE id = v_project_expenses.id;
        END CASE;
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Пересоздаем триггер (на всякий случай)
DROP TRIGGER IF EXISTS trigger_process_completed_task ON tasks;
CREATE TRIGGER trigger_process_completed_task
  AFTER INSERT OR UPDATE OF status
  ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION process_completed_task();
