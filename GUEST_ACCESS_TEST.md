# Тестирование гостевого доступа

## Тестовые ссылки для проверки

### Проект "Барсучок"
- **Токен**: QVeWuEiYn9UYBQPocTAkAHslqjIdeEl7
- **URL**: `http://localhost:5173/guest/project/QVeWuEiYn9UYBQPocTAkAHslqjIdeEl7`
- **Задачи контента**: 2 задачи типа Post со статусом "Pending Client"

### Проект "SMM Drug"
- **Токен**: 74mBjBzZLtmXsAaLYLw5uNF06s4RzYkj
- **URL**: `http://localhost:5173/guest/project/74mBjBzZLtmXsAaLYLw5uNF06s4RzYkj`

### Проект "BlaBlacar"
- **Токен**: 4gDO3jGr4fec2LYNkbIyXTJ3Oqc5FWup
- **URL**: `http://localhost:5173/guest/project/4gDO3jGr4fec2LYNkbIyXTJ3Oqc5FWup`

### Проект "Blagotech"
- **Токен**: gySu0Vgrxlae08cm0UwybjqZS1oNYjGM
- **URL**: `http://localhost:5173/guest/project/gySu0Vgrxlae08cm0UwybjqZS1oNYjGM`

## Что проверять

1. **Скролл**: Страница должна скроллиться полностью вниз
2. **Контент-календарь**: Должны отображаться все задачи с типом Post/Reels/Stories и статусом Pending Client/Approved/Rejected
3. **Дорожная карта**: Должны отображаться этапы проекта из project_roadmap_stages
4. **Заметки**: Должны отображаться заметки проекта

## Отладка в консоли браузера

Откройте DevTools (F12) и проверьте консоль на наличие логов:
- `Guest access validated:` - информация о доступе
- `Project loaded for guest:` - название и ID проекта
- `Guest data loaded:` - количество загруженных данных
- `Guest tasks query:` - результат запроса задач для контента

## Проверка данных в БД

```sql
-- Проверить задачи для проекта "Барсучок"
SELECT id, title, status, type
FROM tasks
WHERE project_id = '9b4ecc32-30c0-47e0-99a5-e7efce1b004b'
AND type IN ('Post', 'Reels', 'Stories')
AND status IN ('Pending Client', 'Approved', 'Rejected');
```
