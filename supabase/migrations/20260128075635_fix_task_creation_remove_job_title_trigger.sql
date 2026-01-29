/*
  # Исправление ошибки создания задач

  Удаляем триггер auto_assign_task_by_job_title, который пытается обратиться 
  к несуществующему полю job_title_id в таблице tasks.
  
  Это поле не было добавлено в таблицу, поэтому триггер вызывает ошибку при создании задач.
*/

-- Удаляем триггер
DROP TRIGGER IF EXISTS trigger_auto_assign_task ON tasks;

-- Удаляем функцию (она не используется нигде больше в текущей версии)
DROP FUNCTION IF EXISTS auto_assign_task_by_job_title();
