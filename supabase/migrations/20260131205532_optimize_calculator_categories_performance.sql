/*
  # Оптимизация производительности категорий калькулятора

  1. Изменения:
    - Добавление индекса для быстрой фильтрации активных категорий
    - Удаление дублированных категорий SMM (оставляем только базовые)
    - Очистка неиспользуемых категорий

  2. Производительность:
    - Индекс на (is_active, sort_order) ускорит запросы категорий
    - Уменьшение количества записей снизит нагрузку на память

  3. Безопасность:
    - Сохраняются все связи через category (не category_id)
    - Не затрагиваются активные категории с услугами
*/

-- Добавляем индекс для быстрой фильтрации активных категорий
CREATE INDEX IF NOT EXISTS idx_calculator_categories_active_sort 
ON calculator_categories (is_active, sort_order) 
WHERE is_active = true;

-- Удаляем дублированные категории SMM (оставляем только 'smm')
DELETE FROM calculator_categories 
WHERE name = 'SMM' 
  AND id != 'smm'
  AND id NOT IN (
    SELECT DISTINCT category FROM calculator_services WHERE category IS NOT NULL
  );

-- Добавляем комментарий к таблице
COMMENT ON TABLE calculator_categories IS 'Категории услуг калькулятора. Кешируются на 5 минут на клиенте.';