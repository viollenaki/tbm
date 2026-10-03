# Backend Rules & Architectural Guidelines (`backend/`)

## 1. Domain-First Modular Architecture

The backend is built with Rust and Axum using strict domain isolation:

```
src/
├── core/             # config, db (PgPool + migrations), error (AppError), openapi, state
├── api/              # root router, /api/v1 prefix, /health, Swagger UI (/swagger-ui)
├── users/            # user listing & existence checks
├── products/         # product catalog
├── vouchers/         # user voucher balances across all products
├── activations/      # atomic voucher activations & activation history
├── admin/            # administrative balance management (upsert)
└── services/         # cross-domain orchestration
```

Each domain module (`users`, `products`, `vouchers`, `activations`, `admin`) MUST follow the exact same structure:
- `mod.rs`: module declaration and Axum `router() -> Router<AppState>`.
- `handlers.rs`: thin HTTP request handlers annotated with `#[utoipa::path]`.
- `service.rs`: domain business logic. **This is the ONLY file that other domain modules may import.**
- `repository.rs`: SQL queries executed via `sqlx::query_as` / `sqlx::query`.
- `models.rs`: database entities deriving `FromRow`. Private to the module.
- `schemas.rs`: request and response DTOs with `serde::{Serialize, Deserialize}` and `utoipa::ToSchema`.

---

## 2. Module Boundaries & Rules

1. **Strictly Forbidden Direct Cross-Imports**:
   ```rust
   // ❌ FORBIDDEN: never access another module's repository or models directly
   use crate::users::repository::UserRepository;
   use crate::products::models::Product;

   // ✅ CORRECT: interact with external domains only via their Service
   use crate::users::service::UserService;
   use crate::products::service::ProductService;
   ```
2. **Runtime SQL Queries**:
   - Always use runtime queries (`sqlx::query_as::<_, T>`, `sqlx::query`) rather than compile-time checked macros (`query!`) to guarantee builds succeed without a live database during Docker image construction and CI.
3. **Atomic Voucher Operations (Concurrency Safety)**:
   - Voucher decrements must be atomic and race-condition free:
     ```sql
     UPDATE voucher_balances
     SET quantity = quantity - 1
     WHERE user_id = $1 AND product_id = $2 AND quantity > 0
     RETURNING quantity;
     ```
   - Rollback transaction if no row returned:
     - Missing user or product $\to$ `404 NOT_FOUND`.
     - Zero balance $\to$ `409 NO_VOUCHERS_LEFT`.
   - Admin upsert must validate `quantity >= 0` (negative values $\to$ `422 VALIDATION_ERROR`).

---

## 3. Error Handling

All errors must be mapped through `AppError` and converted into the uniform JSON format:
```json
{
  "code": "NO_VOUCHERS_LEFT",
  "message": "Ваучеры на этот продукт закончились"
}
```
Standard error codes:
- `NO_VOUCHERS_LEFT` (HTTP 409)
- `NOT_FOUND` (HTTP 404)
- `VALIDATION_ERROR` (HTTP 422)
- `INTERNAL` (HTTP 500)

Never leak raw database error messages to client responses. Log them with `tracing::error!`.

---

## 4. OpenAPI & Documentation

- Every handler must have a complete `#[utoipa::path]` annotation.
- Every schema returned or accepted in a body must derive `utoipa::ToSchema`.
- New endpoints must be added to `paths(...)` in `src/core/openapi.rs`.
- OpenAPI schema must be generatable offline via:
  ```bash
  cargo run --bin gen-openapi
  # or
  cargo run --bin backend -- --print-openapi
  ```

---

## 5. Pre-Commit Verification Checklist

Before completing any backend task, execute:
```bash
cargo fmt --check
cargo clippy -- -D warnings
cargo test --no-run
```
All checks must pass with zero warnings and zero errors.
