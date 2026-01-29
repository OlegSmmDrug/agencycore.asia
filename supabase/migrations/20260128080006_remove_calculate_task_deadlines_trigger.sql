/*
  # Удаление триггера calculate_task_deadlines

  Удаляем триггер calculate_task_deadlines, который пытается обратиться 
  к несуществующему полю stage_id в таблице tasks.
  
  Это поле не существует в таблице, поэтому триггер вызывает ошибку при создании задач.
*/

-- Удаляем триггер
DROP TRIGGER IF EXISTS trigger_calculate_task_deadlines ON tasks;

-- Удаляем функцию
DROP FUNCTION IF EXISTS calculate_task_deadlines();
