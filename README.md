# Semantic Search MVP

MVP системы семантического поиска по корпоративной базе знаний.

## Что умеет

- Поиск по базе знаний на естественном языке.
- Просмотр полного документа.
- Админка (`/admin`) для создания, редактирования и удаления документов.
- Единое хранение документов в Neon Postgres.

## Прод-архитектура

- `web`: Next.js на Railway.
- `api`: FastAPI на Hugging Face Space.
- `db`: Neon Postgres.

Поток запроса:

1. Пользователь ищет на сайте (`Railway`).
2. Next API route `/api/search` проксирует запрос в FastAPI (`HF Space`).
3. FastAPI выполняет semantic search и возвращает top-3.
4. Документы и чанки читаются из Neon.

## Поиск (ядро)

Файл: `pyyy/e5_search.py`

- Модель: `intfloat/multilingual-e5-base` (через `EMBEDDING_MODEL`).
- Поиск идет по чанкам документов.
- Используется кэш эмбеддингов (`.npz`) с сигнатурой данных.
- Для коротких запросов (1-2 слова) используется raw query.
- Для длинных запросов: смешанный вектор raw + wrapped query.
- Финальное ранжирование: semantic score + небольшой lexical bonus.
- Выдача ограничена top-3 и лимитом чанков на документ.

## Хранение данных

Основной источник правды: Neon (`documents`, `document_chunks`).

`pyyy/data/docs.csv` сейчас нужен как seed/fallback:

- если БД пустая при старте API, backend может засеять её из CSV;
- в обычной работе чтение/запись идет в Postgres.

## Админка и безопасность

Защита в 2 слоя:

1. Пароль на фронте (`ADMIN_PASSWORD`) для доступа к `/admin`.
2. Токен между web и api (`ADMIN_API_TOKEN`) для admin CRUD в FastAPI.

Важно: `ADMIN_API_TOKEN` в Railway и HF должен быть одинаковым.

## API

Публичные:

- `POST /search`
- `GET /documents/{doc_id}`
- `GET /health`

Админские (требуют `X-Admin-Token`):

- `GET /documents`
- `POST /documents`
- `PUT /documents/{doc_id}`
- `DELETE /documents/{doc_id}`

## Структура репозитория

```text
app/                 Next.js App Router
components/          UI и страницы
lib/                 клиентское API, auth helpers, типы
pyyy/                FastAPI, поиск, работа с БД
pyyy/data/           seed CSV и кэш эмбеддингов
deploy/              старые nginx/VPS артефакты
Dockerfile.web       Dockerfile для Railway web
pyyy/Dockerfile      Dockerfile для backend (VPS/Compose)
docker-compose.yml   локальный/альтернативный compose сценарий
```

## Переменные окружения

### Railway (`web`)

```env
NODE_ENV=production
PYTHON_API_BASE_URL=https://wildopossum-semantic-api.hf.space
PYTHON_SEARCH_URL=https://wildopossum-semantic-api.hf.space/search
ADMIN_PASSWORD=...
ADMIN_API_TOKEN=...
RAILWAY_DOCKERFILE_PATH=Dockerfile.web
```

Опционально:

```env
SEARCH_UPSTREAM_TIMEOUT_MS=45000
```

### Hugging Face Space (`api`)

```env
DATABASE_URL=postgresql://...
ADMIN_API_TOKEN=...
EMBEDDING_MODEL=intfloat/multilingual-e5-base
```

## Локальный запуск

### Frontend

```bash
npm install
npm run dev
```

Откроется: `http://localhost:3000`

### Backend

```bash
cd pyyy
pip install -r requirements.txt
uvicorn api:app --host 127.0.0.1 --port 8000 --reload
```

Откроется:

- `http://127.0.0.1:8000`
- `http://127.0.0.1:8000/docs`

## Деплой

### Railway (web)

Railway собирается из этого GitHub репозитория (`main`).

### Hugging Face Space (api)

Space сейчас живет в отдельном git-репозитории (`WildOpossum/Semantic-api`) с отдельной историей.
Коммиты из GitHub туда автоматически не попадают.

Если меняется backend (`pyyy/*`), его нужно синхронизировать отдельно в Space.

## Актуальные URL

- Web: `https://semantic.up.railway.app`
- API: `https://wildopossum-semantic-api.hf.space`
- Health: `https://wildopossum-semantic-api.hf.space/health`
- Swagger: `https://wildopossum-semantic-api.hf.space/docs`