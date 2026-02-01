# Диагностика и исправление проблем с расчетом зарплат

## Проблема

Расчет зарплат показывает 0, хотя задачи выполнены. Причины:

1. **Несовпадение типов задач** - задачи создаются с одним типом, а в схемах зарплат указан другой
2. **Отсутствие правил KPI** - в схемах зарплат не настроены ставки для типов задач
3. **Задачи без completedAt** - задачи в статусе Done, но без даты завершения

## Шаг 1: Проверка данных в БД

Выполните SQL запросы из файла `DEBUG_PAYROLL.sql` в Supabase SQL Editor:

### Запрос 1: Проверка схем зарплат
```sql
SELECT
  ss.target_type,
  ss.target_id,
  ss.base_salary,
  jsonb_pretty(ss.kpi_rules) as kpi_rules
FROM salary_schemes ss
WHERE ss.target_id LIKE '%SMM%' OR ss.target_id LIKE '%Контент%' OR ss.target_id LIKE '%Mobilograph%';
```

**Что проверить:**
- Есть ли схема для должности "SMM / Контент-менеджер"?
- Есть ли схема для должности "Mobilograph / Мобилограф"?
- Есть ли правила KPI (kpi_rules) с ненулевыми значениями?
- **ВАЖНО:** Запомните ТОЧНЫЕ названия типов задач из kpi_rules!

### Запрос 2: Проверка calculator_services
```sql
SELECT
  cs.id,
  cs.name,
  cs.category,
  cs.is_active,
  cs.sort_order
FROM calculator_services cs
WHERE cs.category = 'smm' AND cs.is_active = true
ORDER BY cs.sort_order;
```

**Что проверить:**
- Какие ТОЧНЫЕ названия сервисов для SMM? (например "Пост" или "Post")
- Эти названия должны совпадать с типами в kpi_rules из Запроса 1!

### Запрос 3: Проверка реальных типов задач
```sql
SELECT
  type,
  COUNT(*) as count,
  COUNT(CASE WHEN status = 'Done' THEN 1 END) as done_count,
  COUNT(CASE WHEN status = 'Done' AND completed_at IS NOT NULL THEN 1 END) as done_with_date
FROM tasks
WHERE type IS NOT NULL
GROUP BY type
ORDER BY count DESC;
```

**Что проверить:**
- Какие типы задач реально используются в системе?
- Есть ли задачи типа "Shooting" для мобилографов?
- Есть ли задачи с типами из calculator_services?

### Запрос 4: Проверка конкретных задач SMM за январь
```sql
SELECT
  u.name as user_name,
  u.job_title,
  t.title as task_title,
  t.type as task_type,
  t.status,
  t.completed_at,
  p.name as project_name
FROM tasks t
JOIN users u ON t.assignee_id = u.id
LEFT JOIN projects p ON t.project_id = p.id
WHERE
  (u.job_title LIKE '%SMM%' OR u.job_title LIKE '%Контент%')
  AND t.status = 'Done'
  AND t.completed_at >= '2026-01-01'
  AND t.completed_at < '2026-02-01'
ORDER BY u.name, t.completed_at;
```

**Что проверить:**
- Сколько задач Done за январь?
- Какие типы у этих задач?
- Все ли задачи имеют completed_at?

## Шаг 2: Сравнение типов

**КРИТИЧНО:** Типы задач в БД должны ТОЧНО совпадать с типами в схемах зарплат!

Примеры проблем:
- ❌ В схеме: "Пост", в задачах: "Post" → НЕ СОВПАДАЮТ!
- ❌ В схеме: "Рилс", в задачах: "Reels" → НЕ СОВПАДАЮТ!
- ✅ В схеме: "Пост", в задачах: "Пост" → СОВПАДАЮТ!

## Шаг 3: Исправление

### Вариант А: Если типы не совпадают

Нужно либо:
1. Переименовать сервисы в calculator_services чтобы они совпадали с типами задач
2. Или массово обновить типы задач в БД

### Вариант Б: Если правил KPI нет

1. Откройте "Команда" → "Схемы ЗП"
2. Выберите должность (например "SMM / Контент-менеджер")
3. Установите ставки для каждого типа задач (например 5000 за "Пост")
4. Сохраните (автосохранение через 800мс)

### Вариант В: Если задачи без completed_at

Нужно обновить задачи:
```sql
UPDATE tasks
SET completed_at = updated_at
WHERE status = 'Done' AND completed_at IS NULL;
```

## Шаг 4: Проверка в консоли браузера

1. Откройте F12 → Console
2. Откройте "Команда" → "Расчет зарплат"
3. В консоли увидите:

```
[Salary Schemes] Loaded 3 schemes for organization xxx
[Salary Schemes]   - jobTitle/SMM / Контент-менеджер: base=100000, rules=5
```

Если `rules=0` → нет правил, нужно настроить в Шаге 3.

4. Выберите январь 2026, увидите детальный расчет:

```
[Payroll Debug] === Calculating for Иван (SMM) - Month: 2026-01 ===
[Payroll Debug] JobTitle scheme found: YES
[Payroll Debug] KPI rules count: 5
[Payroll Debug] Completed in period: 8
[Payroll Debug] Task type distribution: {Пост: 5, Рилс: 2, Сторис: 1}
[Payroll Debug] Processing KPI rules...
[Payroll Debug] Rule: Пост @ 5000 per task
[Payroll Debug]   - Found 5 tasks of this type
[Payroll Debug]   - Total earnings: 25000
```

**Если "Found 0 tasks"** → типы не совпадают, см. Шаг 2!

## Дополнительно: Мобилографы

Для "Shooting" задач:
1. Проверьте что в схеме зарплат для "Mobilograph / Мобилограф" есть правило для типа "Shooting"
2. Установите ставку (например 15000)
3. Проверьте что задачи имеют тип ТОЧНО "Shooting" (с заглавной S)
