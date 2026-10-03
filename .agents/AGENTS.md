# TBM Project — Agent & Developer Rules

This workspace consists of:
- **`backend/`**: Modular Rust (Axum, SQLx, PostgreSQL) domain-first service.
- **`frontend/`**: Single-Page React (TypeScript, Vite, Tailwind CSS v4, shadcn/ui, TanStack Query) application.

For domain-specific rules, refer directly to:
- 👉 [`backend/AGENTS.md`](backend/AGENTS.md)
- 👉 [`frontend/AGENTS.md`](frontend/AGENTS.md)

---

## General Workspace Policies

1. **Keep CI & Checks 100% Green**:
   - Backend: `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`.
   - Frontend: `pnpm build` (`tsc && vite build`).
2. **Follow Module Boundaries**:
   - In `backend/`, strict domain isolation is enforced. Modules must never cross-import repositories or internal models; interaction is permitted **only through the target domain's `service.rs`**.
3. **No Code Placeholders**:
   - Never write `// TODO: implement later` or dummy mock fallbacks in production code paths. All implementations must be complete, tested, and fully functional.
4. **Preserve Documentation & Comments**:
   - Maintain existing docstrings, schemas, and OpenAPI annotations.
5. **Docker Naming Convention**:
   - Top-level Compose project/stack is always named `tbm`.
   - Containers are strictly named:
     - `postgres_db`
     - `backend`
     - `frontend`
