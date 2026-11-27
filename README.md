# New-Site

Сайт-магазин с каталогом, калькуляторами, личным кабинетом клиента и CRM для сотрудников.
Стек: React 19, Vite, Tailwind, Express (TypeScript, запуск через `tsx`/Node 22), SQLite (`node:sqlite`), Firebase Auth.

## Запуск

```bash
npm install
cp .env.example .env   # заполните значения
npm run dev            # http://localhost:3000 (PORT, HOST настраиваются)
```

| Команда | Что делает |
| --- | --- |
| `npm run dev` | сервер Express + Vite в режиме разработки |
| `npm run build` | продакшен-сборка клиента в `dist/` |
| `npm start` | запуск сервера (`server.ts`) |
| `npm run lint` | проверка типов (`tsc --noEmit`) |
| `npm test` | все тесты `tests/*.test.ts` |

## Переменные окружения

Полный список в `.env.example`. Основные:

- `PORT`, `HOST`, `APP_URL` — адрес сервера и публичный URL сайта.
- `DATA_DIR` — каталог данных: база `energocomfort.db` и загруженные файлы `uploads/`. На Railway укажите путь к смонтированному Volume, иначе данные пропадут при передеплое.
- `SESSION_SECRET` — секрет подписи сессий. Задайте стабильное значение, иначе сессии сбрасываются при перезапуске.
- `ADMIN_LOGIN`, `ADMIN_PASSWORD`, `ADMIN_EMAILS` — главный администратор CRM. Если `ADMIN_PASSWORD` не задан, пароль создаётся через `POST /api/admin/auth/setup` при первом запуске.
- `FIREBASE_*`, `VITE_FIREBASE_*`, `AUTH_DOMAIN(S)` — вход через Google.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET` — уведомления о заявках.
- `GA4_MEASUREMENT_ID`, `GTM_CONTAINER_ID`, `META_PIXEL_ID` — аналитика.

## Структура

- `server.ts` — Express: публичное API, авторизация, CRM API, раздача фронтенда.
- `server/` — база (`db.ts`), авторизация, валидация, SEO, sitemap, Telegram, курс валют.
- `src/` — клиент: `App.tsx`, `components/`, `lib/`.
- `tests/` — тесты на `node:test`.

## Деплой на Railway

Сборка идёт через Railpack (`railpack.json`), деплой происходит при мерже в `main`. Проверьте `DATA_DIR` (Volume) и `SESSION_SECRET` перед первым деплоем.
