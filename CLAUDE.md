# CLAUDE.md — TBM Voucher Service Monorepo

Welcome to the TBM Voucher Service monorepo.

## Project Structure
- `backend/`: Rust 1.85+, Axum 0.8, SQLx 0.8, PostgreSQL 16.
- `frontend/`: React 19, TypeScript, Vite 8, Tailwind CSS v4, shadcn/ui, TanStack Query v5.

## Detailed Agent Rules
- Monorepo general rules: [`.agents/AGENTS.md`](.agents/AGENTS.md)
- Backend domain rules: [`backend/AGENTS.md`](backend/AGENTS.md)
- Frontend client rules: [`frontend/AGENTS.md`](frontend/AGENTS.md)

## Quick Verification Commands
```bash
# Backend checks
cd backend
cargo fmt --check
cargo clippy -- -D warnings
cargo test --no-run

# Frontend checks
cd ../frontend
pnpm build
```

## Docker Stack Execution
- All services: `docker compose up --build`
- Backend only: `cd backend && docker compose up --build`
- Frontend only: `cd frontend && docker compose up --build`
- Stack name: `tbm` (Containers: `postgres_db`, `backend`, `frontend`).
