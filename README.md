# New-Site

Сайт-магазин с каталогом, калькуляторами, личным кабинетом клиента и CRM для сотрудников.
Стек: React 19, Vite, Tailwind, Express (TypeScript, запуск через `tsx`/Node 22), PostgreSQL (`pg` + Drizzle ORM), Redis (`ioredis`, опциональный fallback в памяти), S3 (`@aws-sdk/client-s3`, локальный fallback на диск), Firebase Auth.

## Запуск

```bash
npm install
cp .env.example .env   # заполните значения (DATABASE_URL обязателен)
docker compose up -d   # локальный Postgres 16 и Redis 7
npm run db:migrate     # применить миграции из drizzle/
npm run dev            # http://localhost:3000 (PORT, HOST настраиваются)
```

| Команда | Что делает |
| --- | --- |
| `npm run dev` | сервер Express + Vite в режиме разработки |
| `npm run build` | продакшен-сборка клиента в `dist/` |
| `npm start` | запуск сервера (`server.ts`) |
| `npm run db:generate` | генерация SQL-миграций Drizzle в `drizzle/` |
| `npm run db:migrate` | применение миграций PostgreSQL |
| `npm run lint` | проверка типов (`tsc --noEmit`) |
| `npm test` | все тесты `tests/*.test.ts` (live-PG тесты используют `DATABASE_URL`) |

## Переменные окружения

Полный список в `.env.example`. Основные:

- `PORT`, `HOST`, `APP_URL` — адрес сервера и публичный URL сайта.
- `DATABASE_URL` — строка подключения PostgreSQL (`postgres://...`). Миграции из `drizzle/` также запускаются автоматически при старте сервера; при пустых таблицах каталога/проектов выполняется сид из `server/seed/`.
- `PG_POOL_MAX`, `DATABASE_SSL`, `DATABASE_SSL_REJECT_UNAUTHORIZED` — размер пула соединений (`2..50`, по умолчанию `10`) и TLS-параметры PostgreSQL.
- `REDIS_URL`, `REDIS_TLS_REJECT_UNAUTHORIZED` — подключение к Redis для общих между репликами rate-limit счётчиков, защиты от перебора логина и кеша каталога/курса валют. Если `REDIS_URL` не задан, используется in-memory fallback с предупреждением в логе.
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_PUBLIC_URL` — объектное хранилище для загрузок `POST /api/crm/upload` (multipart до 4 МБ, JPG/PNG/WebP). Если S3 не настроен, файлы сохраняются в `DATA_DIR/uploads`.
- `DATA_DIR` — каталог для локального fallback загрузок и резервных данных (если не используется S3).
- `SESSION_SECRET` — секрет подписи сессий. Задайте стабильное значение на всех репликах, иначе сессии не будут проверяться между инстансами и сбросятся при перезапуске.
- `ADMIN_LOGIN`, `ADMIN_PASSWORD`, `ADMIN_EMAILS`, `ADMIN_SETUP_TOKEN` — главный администратор CRM. Если `ADMIN_PASSWORD` не задан, первичное создание пароля через `POST /api/admin/auth/setup` требует одноразовый токен `ADMIN_SETUP_TOKEN` в заголовке `X-Setup-Token`.
- `LOG_LEVEL` — уровень JSON-логов `pino` (`info`, `warn`, `error`, `debug`), с автоматическим маскированием токенов, паролей и персональных данных.
- `FIREBASE_*`, `VITE_FIREBASE_*`, `AUTH_DOMAIN(S)` — вход через Google.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET` — уведомления о заявках.
- `GA4_MEASUREMENT_ID`, `GTM_CONTAINER_ID`, `META_PIXEL_ID` — аналитика.

## Структура

- `server.ts` — Express: публичное API, авторизация, CRM API, `/api/health` (проверяет Postgres и Redis, `503` при недоступности), graceful shutdown (`SIGTERM`/`SIGINT`), раздача фронтенда.
- `server/` — модули БД `server/db/` (`catalog`, `customers`, `staff`, `deals`, `contacts`, `tasks`, `reviews`, `settings`), Redis (`redis.ts`, `rateLimit.ts`), S3 (`storage.ts`), логирование (`logger.ts`), авторизация, валидация, SEO, sitemap, Telegram, курс валют.
- `drizzle/` — SQL-миграции PostgreSQL (Drizzle Kit).
- `src/` — клиент: `App.tsx`, `components/`, `lib/`.
- `tests/` — тесты на `node:test`.

## Деплой на Railway (несколько реплик)

Сборка идёт через Railpack (`railpack.json`), деплой происходит при мерже в `main`. Для горизонтального масштабирования задайте общие `DATABASE_URL`, `REDIS_URL`, параметры S3 (`S3_*`), `SESSION_SECRET` и `ADMIN_SETUP_TOKEN` (или `ADMIN_PASSWORD`).
