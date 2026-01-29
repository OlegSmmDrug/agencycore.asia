/*
  # Добавление уникального ограничения для схем зарплат

  1. Изменения
    - Добавляется уникальный индекс на (target_id, target_type) в таблице salary_schemes
    - Это обеспечивает, что для каждой комбинации цели (должность или сотрудник) может быть только одна схема
    - Позволяет корректно работать операции upsert
  
  2. Подготовка данных
    - Удаляются дубликаты, оставляя только последние версии схем
    - Это предотвращает ошибку при создании уникального индекса
*/

-- Удаляем дубликаты, оставляя только последние созданные схемы для каждой комбинации target_id/target_type
DELETE FROM salary_schemes
WHERE id NOT IN (
  SELECT DISTINCT ON (target_id, target_type) id
  FROM salary_schemes
  ORDER BY target_id, target_type, created_at DESC
);

-- Создаем уникальный индекс на target_id и target_type
CREATE UNIQUE INDEX IF NOT EXISTS salary_schemes_target_unique 
ON salary_schemes(target_id, target_type);