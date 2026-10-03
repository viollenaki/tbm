# GEMINI.md — TBM Voucher Service Agent Guide

This document defines context, workflows, and strict coding standards for Gemini and AI pair programmers working on the **TBM (Voucher Service)** repository.

---

## 1. System Overview

- **Monorepo Structure**:
  - `backend/`: High-performance, modular Rust service built on Axum 0.8, SQLx 0.8, and PostgreSQL 16.
  - `frontend/`: Single-Page Application built on React 19, TypeScript, Vite 8, Tailwind CSS v4, shadcn/ui, and TanStack Query v5.
- **Business Model**:
  - Users and products are seeded via database migrations.
  - Each user maintains integer voucher balances per product.
  - Admins set absolute voucher balances for users (upsert, $\ge 0$).
  - Users activate vouchers atomically (balance $-1$, timestamped activation recorded).
  - Depleted balances return `409 NO_VOUCHERS_LEFT`.
  - Missing entities return `404 NOT_FOUND`.

---

## 2. Global Agent Standards

1. **Keep CI Checks 100% Green**:
   - Backend: `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`.
   - Frontend: `pnpm build` (`tsc && vite build`).
2. **Follow Module Boundaries**:
   - Strict domain isolation is enforced in `backend/`. Inter-module communication must pass **only through the target module's `service.rs`**. Never cross-import repositories or models.
3. **No Code Placeholders**:
   - Never write `// TODO` or mock fallbacks in production paths. All logic must be complete and functional.
4. **Preserve Documentation Integrity**:
   - Maintain all docstrings, comments, OpenAPI annotations, and schemas.
5. **Docker Naming Standards**:
   - Top-level Compose project/stack is named `tbm`.
   - Containers are named: `postgres_db`, `backend`, `frontend`.

---

## 3. Quick Reference Commands

### Backend (`backend/`)
```bash
# Code formatting
cargo fmt --check
cargo fmt

# Strict linter
cargo clippy -- -D warnings

# Build & test checks
cargo test --no-run
cargo test

# Generate offline OpenAPI JSON specification
cargo run --bin gen-openapi > ../frontend/openapi.json
```

### Frontend (`frontend/`)
```bash
# Development server with backend proxy
pnpm dev

# Full TypeScript typecheck and Vite build
pnpm build

# Regenerate typed React Query client from OpenAPI
pnpm generate:api
```

### Docker Compose
```bash
# Full stack (Postgres + Backend + Frontend)
docker compose up --build

# Standalone backend (+ Postgres)
cd backend && docker compose up --build

# Standalone frontend
cd frontend && docker compose up --build
```

---

## 4. Module-Specific Guides
- Detailed backend architectural rules: [`backend/GEMINI.md`](backend/GEMINI.md) & [`backend/AGENTS.md`](backend/AGENTS.md)
- Detailed frontend architectural rules: [`frontend/GEMINI.md`](frontend/GEMINI.md) & [`frontend/AGENTS.md`](frontend/AGENTS.md)
