# GEMINI.md — Frontend Guide (`frontend/`)

Instructions for Gemini and AI agents developing the React + Vite frontend application.

---

## 1. Tech Stack & Foundations

- **Framework**: React 19 with TypeScript and Vite 8.
- **Styling**: Tailwind CSS v4 with semantic CSS variables (`@tailwindcss/vite`).
- **Components**: [shadcn/ui](https://ui.shadcn.com/) (`src/components/ui/`).
- **Server State**: [TanStack Query v5](https://tanstack.com/query) with Orval auto-generated client.

---

## 2. API Client & Code Generation Rules

1. **Auto-Generated Code in `src/api/generated/`**:
   - The API client, types, and hooks are generated from `openapi.json` by **Orval**.
   - **NEVER manually edit files in `src/api/generated/`**. All manual changes are overwritten on the next generation.
2. **Regeneration Workflow**:
   ```bash
   # 1. Export schema from backend
   cd ../backend
   cargo run --bin gen-openapi > ../frontend/openapi.json

   # 2. Run Orval generator
   cd ../frontend
   pnpm generate:api
   ```
3. **HTTP Client (`src/api/mutator/custom-client.ts`)**:
   - Custom client handles `VITE_API_URL` prefixing, dev-proxying, and uniform error payload unwrapping into `ErrorResponse`.

---

## 3. Query Management & Cache Invalidation

- Always use the generated query options functions (`getListUsersQueryOptions`, `getGetUserBalancesQueryOptions`, etc.).
- When executing mutations (`useActivateVoucher`, `useSetVoucherBalance`), **always invalidate relevant query caches**:
  ```typescript
  // Invalidate user balances and activation history
  queryClient.invalidateQueries({
    queryKey: getGetUserBalancesQueryKey(userId),
  });
  queryClient.invalidateQueries({
    queryKey: getGetUserActivationsQueryKey(userId),
  });
  ```

---

## 4. UI & UX Standards

1. **Class Merging**:
   - Always combine Tailwind classes with `cn()` from `@/lib/utils`.
2. **Color System**:
   - Use semantic theme tokens (`bg-background`, `text-foreground`, `bg-card`, `text-primary`, `border-border`, etc.) instead of hardcoded color values.
3. **State Representation**:
   - **Loading**: Render `Skeleton` components.
   - **Errors**: Render `Alert` components with a retry button.
   - **Depleted Vouchers**: Show clear, user-friendly Russian message: *«Ваучеры на этот продукт закончились»*.
   - **Localization**: Format all dates and times in `ru-RU` locale.

---

## 5. Verification Checklist

Always test the build before submitting code changes:
```bash
pnpm build
```
Verify exit code 0, zero TypeScript errors, and successful Vite bundling.
