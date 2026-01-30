/*
  # Добавление выбора видимых метрик контента

  1. Changes
    - Добавление поля `content_metrics_visible` в таблицу `projects`
    - Это поле хранит массив ключей метрик, которые нужно отображать в виджете контента
    - По умолчанию NULL (показывать все метрики)

  2. Details
    - Поле `content_metrics_visible` - массив текстовых ключей метрик
    - Позволяет пользователю выбирать, какие метрики из калькулятора отслеживать
    - Примеры: ['posts', 'reels_production', 'stories']
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'content_metrics_visible'
  ) THEN
    ALTER TABLE projects ADD COLUMN content_metrics_visible TEXT[];
  END IF;
END $$;