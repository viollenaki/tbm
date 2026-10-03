# Сервис ваучеров (активаций) — Backend + Frontend

Полнофункциональный модульный сервис управления запасом ваучеров на продукты и их атомарной активации.

---

## Стек технологий

- **Backend**: Rust 1.85+, [Axum 0.8](https://github.com/tokio-rs/axum), [SQLx 0.8](https://github.com/launchbadge/sqlx), PostgreSQL 16, [utoipa](https://github.com/juhaku/utoipa) (OpenAPI / Swagger UI), [tracing](https://github.com/tokio-rs/tracing), [thiserror](https://github.com/dtolnay/thiserror).
- **Frontend**: React 19, TypeScript, [Vite 8](https://vite.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), [TanStack Query v5](https://tanstack.com/query), [Orval](https://orval.dev/) (генерация типизированного клиента из OpenAPI).
- **DevOps & Контейнеризация**: Docker, Docker Compose, Multi-stage сборка (cargo-chef для кэширования слоев Rust, nginx для раздачи frontend и обратного проксирования).

---

## Архитектура Backend (Domain-First)

Проект организован по модульному принципу разделения ответственности (Handlers → Service → Repository → Models/Schemas):

```
backend/
├── Cargo.toml
├── Dockerfile                  # Multi-stage сборка на базе cargo-chef + непривилегированный пользователь
├── docker-compose.yml          # Автономный compose для запуска бэкенда с PostgreSQL
├── migrations/                 # SQLx миграции (схема БД + seed пользователей и продуктов)
│   └── 0001_init.sql
├── tests/
│   └── integration_tests.rs    # Интеграционные тесты на PostgreSQL (включая гонки/параллелизм)
└── src/
    ├── lib.rs                  # Корневая библиотека (экспорт доменов)
    ├── main.rs                 # Точка входа: config, db pool, миграции, graceful shutdown, --print-openapi
    ├── bin/
    │   └── gen_openapi.rs      # Утилита вывода OpenAPI JSON без запуска сервера и без БД
    ├── core/                   # config, db (pool + auto-migrate), error (AppError -> JSON), openapi, state
    ├── api/                    # Роутер, версионирование /api/v1, /health, Swagger UI (/swagger-ui)
    ├── users/                  # Модуль пользователей (чтение списка)
    ├── products/               # Модуль продуктов (чтение списка)
    ├── vouchers/               # Модуль балансов ваучеров пользователей по всем продуктам
    ├── activations/            # Атомарная активация ваучеров и история списаний
    ├── admin/                  # Админ-операции (upsert запаса ваучеров с валидацией)
    └── services/               # Межмодульная оркестрация
```

### Корректность и атомарность активации

Активация ваучера гарантированно потокобезопасна и не может загнать баланс в минус при параллельных запросах:
1. Выполняется атомарный запрос внутри транзакции:
   ```sql
   UPDATE voucher_balances
   SET quantity = quantity - 1
   WHERE user_id = $1 AND product_id = $2 AND quantity > 0
   RETURNING quantity;
   ```
2. Если строка обновлена:
   - Записывается факт активации в `activations` (`INSERT INTO activations ...`).
   - Транзакция фиксируется (`COMMIT`).
   - Возвращается успешный ответ с оставшимся балансом.
3. Если строка не найдена:
   - Транзакция откатывается (`ROLLBACK`).
   - Проверяется существование пользователя и продукта (если не найдены — `404 NOT_FOUND`).
   - Если пользователь и продукт существуют, но баланс `0` — возвращается ошибка бизнеса `409 NO_VOUCHERS_LEFT` («Ваучеры на этот продукт закончились»). История при этом гарантированно **не** пополняется.

---

## Архитектура Frontend

Расположена в папке `frontend/`:

```
frontend/
├── Dockerfile                  # Multi-stage сборка node -> nginx alpine
├── docker-compose.yml          # Автономный compose для фронтенда
├── nginx.conf                  # Nginx конфиг с проксированием /api, /swagger-ui и SPA fallback
├── openapi.json                # Спецификация OpenAPI бэкенда
├── orval.config.ts             # Конфигурация генератора TanStack Query хуков
├── src/
│   ├── api/
│   │   ├── mutator/            # customClient с поддержкой VITE_API_URL и обработкой ошибок
│   │   └── generated/          # Автосгенерированные хуки и типы (руками не правятся)
│   ├── components/ui/          # shadcn/ui компоненты (Button, Card, Badge, Input, Alert, Skeleton)
│   ├── lib/                    # Утилиты (cn / twMerge)
│   ├── pages/
│   │   ├── UserPortalPage.tsx  # Клиентский портал активации услуг (/)
│   │   └── AdminPage.tsx       # Выделенная панель администратора (/admin)
│   ├── App.tsx                 # Роутер маршрутов (/ и /admin) и глобальные уведомления
│   └── main.tsx                # Инициализация React 19 + QueryClientProvider
```

---

## Быстрый запуск через Docker Compose

### 1. Все сервисы вместе (PostgreSQL + Backend + Frontend)

В корневой директории выполните:

```bash
docker compose up --build
```

После запуска доступны:
- **Frontend**: [http://localhost:3000](http://localhost:3000) (Пользовательский портал)
- **Frontend Admin Panel**: [http://localhost:3000/admin](http://localhost:3000/admin) (Панель администратора)
- **Backend API**: [http://localhost:8080](http://localhost:8080)
- **Swagger UI**: [http://localhost:8080/swagger-ui](http://localhost:8080/swagger-ui) *(доступен исключительно напрямую с бэкенда)*
- **OpenAPI JSON**: [http://localhost:8080/api-docs/openapi.json](http://localhost:8080/api-docs/openapi.json)

---

## Автономный запуск через персональные docker-compose

### Только Backend (+ PostgreSQL):
```bash
cd backend
docker compose up --build
```
Backend запустится на порту `8080` вместе с изолированным PostgreSQL.

### Только Frontend:
```bash
cd frontend
docker compose up --build
```
Frontend запустится на порту `3000`.

---

## Локальный запуск для разработки

### 1. Переменные окружения
Скопируйте пример файла конфигурации:
```bash
cp .env.example .env
```

### 2. Запуск PostgreSQL
Если у вас установлен Docker, можно поднять только базу:
```bash
docker compose up -d postgres_db
```
Либо используйте локальный сервер PostgreSQL с базой данных `vouchers`.

### 3. Запуск Backend
Миграции и начальные данные (seed) применятся автоматически при старте сервера:
```bash
cd backend
cargo run
```

### 4. Запуск Frontend
В отдельном терминале:
```bash
cd frontend
pnpm install
pnpm dev
```
Фронтенд запустится на [http://localhost:3000](http://localhost:3000) и настроен на проксирование запросов `/api` на `http://localhost:8080`.

---

## OpenAPI и генерация API-клиента

Спецификация генерируется декларативно через `utoipa`. Получить актуальный `openapi.json` можно без запуска сервера и базы данных:

1. Генерация OpenAPI файла из бэкенда:
   ```bash
   cd backend
   cargo run --bin gen-openapi > ../frontend/openapi.json
   ```
   *(Также поддерживается флаг: `cargo run --bin backend -- --print-openapi`)*

2. Генерация типизированного клиента и React Query хуков для фронтенда:
   ```bash
   cd frontend
   pnpm generate:api
   ```
   Сгенерированные файлы сохраняются в `frontend/src/api/generated/`.

---

## Тестирование (Backend)

Интеграционные тесты проверяют все критические требования бизнес-логики:
- Успешная активация ваучера: баланс уменьшается на 1, запись появляется в истории списаний.
- Активация при нулевом запасе: возвращает статус `409` с кодом `NO_VOUCHERS_LEFT`, запись в историю не добавляется.
- Административная установка запаса: создание новой записи и перезапись существующей, валидация отрицательного значения (`422 VALIDATION_ERROR`).
- Обработка несуществующего пользователя или продукта: возвращает `404 NOT_FOUND`.
- **Тест на состояние гонки (Concurrency / Race condition)**: $N$ параллельных запросов активации при исходном запасе $M < N$ гарантированно завершаются ровно $M$ успехами и $N-M$ ответами `409 Conflict`. Конечный баланс строго равен `0` и никогда не становится отрицательным.

Запуск тестов:
```bash
cd backend
cargo test
```

Проверка форматирования и линтера:
```bash
cd backend
cargo fmt --check
cargo clippy -- -D warnings
```

---

## REST API Эндпоинты (`/api/v1`)

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/health` / `/api/v1/health` | Проверка жизнеспособности сервиса |
| `GET` | `/api/v1/users` | Список всех пользователей |
| `GET` | `/api/v1/products` | Каталог всех продуктов |
| `GET` | `/api/v1/users/{user_id}/balances` | Баланс ваучеров пользователя по всем продуктам (включая 0) |
| `GET` | `/api/v1/users/{user_id}/activations` | История активаций пользователя (новые сверху) |
| `POST` | `/api/v1/users/{user_id}/activations` | Атомарная активация ваучера на продукт (`{ "product_id": "..." }`) |
| `PUT` | `/api/v1/admin/users/{user_id}/balances/{product_id}` | Установка запаса ваучеров (`{ "quantity": N }`) |
