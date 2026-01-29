/*
  # Автоматизация начисления оплаты при завершении задач

  ## Описание
  Создает систему автоматического начисления оплаты сотрудникам при завершении задач.
  При переводе задачи в статус "Done" система:
  1. Определяет тип задачи и должность исполнителя
  2. Находит ставку оплаты для этой комбинации
  3. Добавляет оплату в расчет зарплаты (payroll_records)
  4. Если задача привязана к проекту, добавляет часы в расходы проекта (project_expenses)

  ## Новые таблицы
  
  ### `task_type_rates`
  Хранит ставки оплаты для разных типов задач и должностей:
  - `id` (uuid, primary key)
  - `organization_id` (uuid) - организация
  - `job_title` (text) - должность исполнителя
  - `task_type` (text) - тип задачи (Shooting, Meeting, Post и т.д.)
  - `rate_per_hour` (numeric) - ставка за час работы
  - `is_active` (boolean) - активна ли ставка
  - `created_at`, `updated_at` (timestamptz)

  ## Изменения в существующих таблицах
  
  ### `payroll_records`
  Добавлено поле `task_payments` (jsonb) - детализация оплат по завершенным задачам:
  ```json
  [
    {
      "task_id": "uuid",
      "task_title": "string",
      "task_type": "string",
      "hours": number,
      "rate": number,
      "amount": number,
      "completed_at": "timestamp"
    }
  ]
  ```

  ## Функции
  
  ### `process_completed_task()`
  Триггерная функция, которая срабатывает при изменении статуса задачи на "Done".
  Автоматически начисляет оплату и обновляет расходы проекта.

  ## Безопасность
  - Все таблицы наследуют organization_id для изоляции данных
  - RLS отключен для простоты (в соответствии с текущей архитектурой)
*/

-- Создаем таблицу ставок для типов задач
CREATE TABLE IF NOT EXISTS task_type_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  job_title text NOT NULL,
  task_type text NOT NULL,
  rate_per_hour numeric NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, job_title, task_type)
);

CREATE INDEX IF NOT EXISTS idx_task_type_rates_org ON task_type_rates(organization_id);
CREATE INDEX IF NOT EXISTS idx_task_type_rates_lookup ON task_type_rates(organization_id, job_title, task_type) WHERE is_active = true;

-- Добавляем поле для детализации оплат по задачам в payroll_records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_records' AND column_name = 'task_payments'
  ) THEN
    ALTER TABLE payroll_records ADD COLUMN task_payments jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Функция для обработки завершенных задач
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

    -- Получаем ставку для этого типа задачи и должности
    SELECT rate_per_hour INTO v_rate
    FROM task_type_rates
    WHERE organization_id = NEW.organization_id
      AND job_title = v_user_job_title
      AND task_type = NEW.type
      AND is_active = true
    LIMIT 1;

    -- Если ставка не найдена, завершаем обработку
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

-- Создаем триггер на таблицу tasks
DROP TRIGGER IF EXISTS trigger_process_completed_task ON tasks;
CREATE TRIGGER trigger_process_completed_task
  AFTER INSERT OR UPDATE OF status
  ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION process_completed_task();

-- Функция обновления updated_at
CREATE OR REPLACE FUNCTION update_task_type_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_task_type_rates_updated_at
  BEFORE UPDATE ON task_type_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_task_type_rates_updated_at();
