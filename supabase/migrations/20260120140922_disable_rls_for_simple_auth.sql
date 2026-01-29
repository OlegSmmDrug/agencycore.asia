/*
  # Отключение RLS для простой авторизации

  Отключаем RLS для основных таблиц, так как используется простая авторизация
  через localStorage без Supabase Auth. Фильтрация по организациям происходит
  на уровне приложения.

  1. Changes
    - Отключение RLS для users
    - Отключение RLS для organizations
    - Отключение RLS для projects
    - Отключение RLS для clients
    - Отключение RLS для tasks
*/

-- Отключаем RLS для основных таблиц
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
