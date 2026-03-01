# Semantic Search MVP

MVP системы семантического поиска по корпоративной базе знаний.

Проект реализует:
- поиск документов по смыслу через эмбеддинги `E5`
- пользовательский веб-интерфейс поиска
- защищенную админку для добавления, редактирования и удаления документов
- хранение документов в `Neon Postgres`

## Стек

- Frontend: `Next.js 16`, `React 19`, `TypeScript`
- Backend API: `FastAPI`
- Semantic search: `sentence-transformers`, модель `intfloat/multilingual-e5-base`
- Database: `Neon Postgres`
- Frontend deploy: `Railway`
- Backend deploy: `Hugging Face Space`

## Архитектура

Схема работы в проде:

1. Пользователь работает с фронтом на Railway.
2. Поиск идет через Next API route `/api/search`.
3. Next проксирует запрос в Python API на Hugging Face Space.
4. Python API выполняет семантический поиск по базе знаний.
5. Документы и чанки хранятся в Neon.
6. Админка доступна только после входа по паролю.
7. CRUD-запросы из админки проходят через Next admin API и дополнительно защищены `ADMIN_API_TOKEN`.

## Основные возможности

- Семантический поиск по базе знаний
- Выдача `top-3` результатов
- Просмотр полного документа
- Добавление документа через админку
- Редактирование документа
- Удаление документа
- Общая онлайн-БД для всех пользователей и устройств

## Структура проекта

```text
app/                    Next.js app router
components/             UI и клиентские компоненты
lib/                    клиентское API, auth helpers, типы
pyyy/                   FastAPI backend и логика поиска
pyyy/data/              seed CSV и готовые кэши эмбеддингов
deploy/                 старые VPS/nginx артефакты
Dockerfile.web          Dockerfile фронта
pyyy/Dockerfile         Dockerfile backend для Docker/VPS
docker-compose.yml      старый compose-сценарий
```

## Переменные окружения

### Railway `web`

Обязательные:

```env
NODE_ENV=production
PYTHON_API_BASE_URL=https://wildopossum-semantic-api.hf.space
PYTHON_SEARCH_URL=https://wildopossum-semantic-api.hf.space/search
ADMIN_PASSWORD=your_admin_password
ADMIN_API_TOKEN=your_shared_admin_token
```

Дополнительно для Railway:

```env
RAILWAY_DOCKERFILE_PATH=Dockerfile.web
```

### Hugging Face Space `api`

Обязательные:

```env
DATABASE_URL=postgresql://...
ADMIN_API_TOKEN=your_shared_admin_token
```

Опционально:

```env
EMBEDDING_MODEL=intfloat/multilingual-e5-base
```

Важно:
- `ADMIN_API_TOKEN` в Railway и Hugging Face должен быть одинаковым
- `ADMIN_PASSWORD` нужен только фронту

## Локальный запуск

### 1. Frontend

```bash
npm install
npm run dev
```

Фронт будет доступен на:

```text
http://localhost:3000
```

### 2. Python API

```bash
cd pyyy
pip install -r requirements.txt
uvicorn api:app --host 127.0.0.1 --port 8000 --reload
```

API будет доступен на:

```text
http://127.0.0.1:8000
http://127.0.0.1:8000/docs
```

### 3. Локальные env для фронта

Для локального фронта можно использовать:

```env
PYTHON_API_BASE_URL=http://127.0.0.1:8000
PYTHON_SEARCH_URL=http://127.0.0.1:8000/search
ADMIN_PASSWORD=your_admin_password
ADMIN_API_TOKEN=your_shared_admin_token
```

И тот же `ADMIN_API_TOKEN` нужно задать для локального Python API.

## API

### Публичные маршруты

- `POST /search`
- `GET /documents/{doc_id}`

### Админские маршруты

Требуют `X-Admin-Token`:

- `GET /documents`
- `POST /documents`
- `PUT /documents/{doc_id}`
- `DELETE /documents/{doc_id}`

## Хранение данных

Сейчас документы хранятся в Neon:

- таблица `documents`
- таблица `document_chunks`

При первом запуске backend может seed-нуть базу из `pyyy/data/docs.csv`, если база пустая.

## Деплой

### Текущий рабочий прод-вариант

- Frontend: Railway
- Backend API: Hugging Face Space
- Database: Neon

### Альтернативный вариант

В репозитории также остались Docker/VPS-артефакты:

- [`docker-compose.yml`](/c:/Project/docker-compose.yml)
- [`Dockerfile.web`](/c:/Project/Dockerfile.web)
- [`pyyy/Dockerfile`](/c:/Project/pyyy/Dockerfile)
- [`DEPLOY.md`](/c:/Project/DEPLOY.md)

Этот вариант можно использовать для VPS-деплоя.

## Что важно знать

- Hugging Face Space используется как backend-хостинг для FastAPI.
- Railway free не тянул модель поиска по памяти, поэтому backend вынесен отдельно.
- Админка теперь защищена паролем.
- CRUD в базе идет через Neon, а не через локальный `csv`.

## Текущее состояние MVP

Проект соответствует базовым требованиям MVP:

- есть веб-интерфейс поиска
- есть семантический поиск
- есть админка документов
- есть хранение данных в онлайн-БД
- есть рабочий облачный деплой

## Что можно улучшить дальше

- добавить `README`-секцию с демонстрационным сценарием для защиты
- добавить `health` endpoint в Python API
- убрать технический долг из `pyyy/e5_search.py`
- добавить smoke tests
- при необходимости перенести embeddings в базу или отдельный индексный сервис
