/*
  # Добавление себестоимости к услугам калькулятора

  ## Изменения
  1. Добавляем поле `cost_price` в таблицу `calculator_services`
     - `cost_price` (numeric) - себестоимость услуги (цена исполнителя)
     - Существующее поле `price` остается как цена продажи клиенту
     
  ## Примечание
  - `price` - цена продажи клиенту
  - `cost_price` - себестоимость (цена исполнителя), используется в расходах
*/

-- Добавляем поле для себестоимости
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calculator_services' AND column_name = 'cost_price'
  ) THEN
    ALTER TABLE calculator_services 
    ADD COLUMN cost_price numeric DEFAULT 0;
  END IF;
END $$;

-- Добавляем комментарий для документации
COMMENT ON COLUMN calculator_services.cost_price IS 'Себестоимость услуги (цена исполнителя), используется в расчете расходов';
COMMENT ON COLUMN calculator_services.price IS 'Цена продажи клиенту, используется в калькуляторе';