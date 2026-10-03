# Frontend Rules & Architectural Guidelines (`frontend/`)

## 1. Stack & Architecture

- **Framework**: React 19 with TypeScript and Vite 8.
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`, CSS variables, `@theme inline`).
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) (`src/components/ui/`).
- **Server State**: [TanStack Query v5](https://tanstack.com/query) with Orval auto-generated hooks.

---

## 2. API Client & Code Generation Rules

1. **Auto-Generated Code in `src/api/generated/`**:
   - The API client and React Query hooks are generated automatically by **Orval** from `openapi.json`.
   - **DO NOT modify files in `src/api/generated/` manually.** Any manual changes will be lost on regeneration.
2. **Regeneration Procedure**:
   Whenever backend endpoints or DTO schemas change:
   ```bash
   # 1. Export schema from backend
   cd ../backend
   cargo run --bin gen-openapi > ../frontend/openapi.json

   # 2. Re-run Orval generator
   cd ../frontend
   pnpm generate:api
   ```
3. **Custom HTTP Client**:
   - Network calls route through [`src/api/mutator/custom-client.ts`](src/api/mutator/custom-client.ts), which manages the base URL (`VITE_API_URL` or dev proxy) and uniform error payload unwrapping.

---

## 3. State Management & Query Invalidation

- Always use the generated query option functions (`getListUsersQueryOptions`, `getGetUserBalancesQueryOptions`, etc.).
- When executing mutations (`useActivateVoucher`, `useSetVoucherBalance`), **always invalidate related query caches**:
  ```typescript
  // Invalidate balances and activations on voucher activation
  queryClient.invalidateQueries({
    queryKey: getGetUserBalancesQueryKey(userId),
  });
  queryClient.invalidateQueries({
    queryKey: getGetUserActivationsQueryKey(userId),
  });
  ```

---

## 4. UI & UX Standards

1. **Class Name Merging**:
   - Always use the `cn()` helper from `@/lib/utils` (`clsx` + `tailwind-merge`).
2. **Color Palette & Themes**:
   - Use semantic Tailwind CSS theme tokens (`bg-background`, `text-foreground`, `bg-card`, `text-primary`, `border-border`, etc.) rather than hardcoded hex codes.
3. **User Feedback & Edge Cases**:
   - Display `Skeleton` placeholders while queries are loading.
   - Provide an error banner with a «Повторить» (retry) button if fetching fails.
   - For `NO_VOUCHERS_LEFT`, provide the friendly Russian message: *«Ваучеры на этот продукт закончились»*.
   - Date and time formatting must use Russian locale (`ru-RU`).

---

## 5. Pre-Commit Verification Checklist

Before finishing any frontend task, verify that TypeScript compilation and Vite packaging succeed:
```bash
pnpm build
```
Ensure zero TypeScript diagnostics and a clean asset build.
