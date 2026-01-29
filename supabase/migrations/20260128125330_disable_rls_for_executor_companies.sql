/*
  # Отключение RLS для executor_companies

  ## Изменения
  - Отключаем RLS для таблицы `executor_companies`
  - Удаляем политики безопасности, так как используется simple auth

  ## Причина
  - Система использует simple auth (не Supabase Auth)
  - CURRENT_USER возвращает роль БД, а не email пользователя
  - Изоляция данных контролируется на уровне приложения через organization_id
*/

-- Удаляем политики
DROP POLICY IF EXISTS "Users can view own organization executor companies" ON executor_companies;
DROP POLICY IF EXISTS "Users can insert own organization executor companies" ON executor_companies;
DROP POLICY IF EXISTS "Users can update own organization executor companies" ON executor_companies;
DROP POLICY IF EXISTS "Users can delete own organization executor companies" ON executor_companies;

-- Отключаем RLS
ALTER TABLE executor_companies DISABLE ROW LEVEL SECURITY;
