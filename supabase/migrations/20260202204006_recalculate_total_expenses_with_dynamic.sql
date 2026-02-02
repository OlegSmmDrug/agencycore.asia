/*
  # Пересчет total_expenses с учетом dynamic_expenses

  1. Функция
    - Пересчитывает total_expenses для всех записей project_expenses
    - Учитывает dynamic_expenses + fot_expenses + models_expenses + other_expenses
  
  2. Применение
    - Обновляет все записи с dynamic_expenses
*/

-- Пересчитываем total_expenses для всех записей
UPDATE project_expenses
SET total_expenses = (
  COALESCE(
    (
      SELECT SUM((value->>'cost')::numeric)
      FROM jsonb_each(COALESCE(dynamic_expenses, '{}'::jsonb))
    ), 
    0
  ) +
  COALESCE(fot_expenses, 0) +
  COALESCE(models_expenses, 0) +
  COALESCE(other_expenses, 0) +
  CASE 
    WHEN (
      SELECT COUNT(*)
      FROM jsonb_each(COALESCE(dynamic_expenses, '{}'::jsonb))
      WHERE value->>'category' = 'video'
    ) > 0 
    THEN 0
    ELSE COALESCE(production_expenses, 0)
  END
),
margin_percent = CASE 
  WHEN revenue > 0 THEN 
    ((revenue - (
      COALESCE(
        (
          SELECT SUM((value->>'cost')::numeric)
          FROM jsonb_each(COALESCE(dynamic_expenses, '{}'::jsonb))
        ), 
        0
      ) +
      COALESCE(fot_expenses, 0) +
      COALESCE(models_expenses, 0) +
      COALESCE(other_expenses, 0) +
      CASE 
        WHEN (
          SELECT COUNT(*)
          FROM jsonb_each(COALESCE(dynamic_expenses, '{}'::jsonb))
          WHERE value->>'category' = 'video'
        ) > 0 
        THEN 0
        ELSE COALESCE(production_expenses, 0)
      END
    )) / revenue * 100)
  ELSE 0
END
WHERE dynamic_expenses IS NOT NULL
  AND jsonb_typeof(dynamic_expenses) = 'object';