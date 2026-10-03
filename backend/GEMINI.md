# GEMINI.md — Backend Guide (`backend/`)

Instructions for Gemini and AI agents developing the Rust backend service.

---

## 1. Architecture: Domain-First Modular Monolith

Every business domain (`users`, `products`, `vouchers`, `activations`, `admin`) adheres strictly to this file structure:

- `mod.rs`: exports and Axum router definition (`pub fn router() -> Router<AppState>`).
- `handlers.rs`: thin HTTP request handlers annotated with `#[utoipa::path]`. Must not contain business logic or raw SQL.
- `service.rs`: domain business rules and validation. **This is the ONLY file that other domains may import.**
- `repository.rs`: database access using SQLx runtime queries (`sqlx::query_as`, `sqlx::query`).
- `models.rs`: database entities deriving `sqlx::FromRow`. Private to the domain.
- `schemas.rs`: request and response DTOs with `serde::{Serialize, Deserialize}` and `utoipa::ToSchema`.

Infrastructure lives in `src/core/` (`config`, `db`, `error`, `openapi`, `state`) and `src/api/` (root router, Swagger UI, versioning).

---

## 2. Strict Invariants & Policies

1. **No Direct Model/Repository Cross-Imports**:
   ```rust
   // ❌ VIOLATION:
   use crate::users::repository::UserRepository;
   use crate::products::models::Product;

   // ✅ COMPLIANT:
   use crate::users::service::UserService;
   use crate::products::service::ProductService;
   ```
2. **Runtime SQL Queries**:
   - Do NOT use `sqlx::query!` or compile-time database checking.
   - Use `sqlx::query_as::<_, Entity>("SELECT ...").fetch_all(pool).await?`.
   - This ensures offline compilation in Docker builds without requiring a live database or `.sqlx` cache.
3. **Atomic Concurrency for Activations**:
   - Always execute voucher activations inside a single database transaction (`pool.begin().await?`):
     ```sql
     UPDATE voucher_balances
     SET quantity = quantity - 1
     WHERE user_id = $1 AND product_id = $2 AND quantity > 0
     RETURNING quantity;
     ```
   - If row returned: insert into `activations`, commit transaction.
   - If no row returned: rollback transaction, verify user/product existence (`404` if not found), return `409 NO_VOUCHERS_LEFT` if balance is 0.
4. **Uniform Error Structure**:
   All errors must serialize as:
   ```json
   {
     "code": "NO_VOUCHERS_LEFT",
     "message": "Ваучеры на этот продукт закончились"
   }
   ```
   Never leak raw database error details to clients; log them using `tracing::error!`.
5. **No `unwrap()` in Business Paths**:
   - Always propagate errors using `?` or map them to `AppError`.

---

## 3. OpenAPI Annotations

- All endpoints must include complete `#[utoipa::path]` metadata.
- All request/response types must derive `utoipa::ToSchema`.
- Exporting the schema must work offline:
  ```bash
  cargo run --bin gen-openapi > ../frontend/openapi.json
  ```

---

## 4. Verification Checklist

Always run these commands before submitting backend changes:
```bash
cargo fmt --check
cargo clippy -- -D warnings
cargo test --no-run
```
All commands must complete with exit code 0 and zero warnings.
