import React, { type ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type {
  UserDto,
  ProductDto,
  VoucherBalanceDto,
  ActivationHistoryItemDto,
} from "../api/generated/models";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface ExtendedRenderOptions extends Omit<RenderOptions, "queries"> {
  queryClient?: QueryClient;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    queryClient = createTestQueryClient(),
    ...renderOptions
  }: ExtendedRenderOptions = {},
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return {
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

// Sample mock data for tests
export const mockUsers: UserDto[] = [
  { id: "usr_alice", name: "Алиса Селезнева", created_at: "2026-10-01T10:00:00Z" },
  { id: "usr_bob", name: "Боб Марли", created_at: "2026-10-01T10:00:00Z" },
];

export const mockProducts: ProductDto[] = [
  { id: "prd_cinema", name: "Билет в кино", created_at: "2026-10-01T10:00:00Z" },
  { id: "prd_coffee", name: "Кофе капучино", created_at: "2026-10-01T10:00:00Z" },
];

export const mockBalances: VoucherBalanceDto[] = [
  {
    product_id: "prd_cinema",
    product_name: "Билет в кино",
    quantity: 2,
  },
  {
    product_id: "prd_coffee",
    product_name: "Кофе капучино",
    quantity: 0,
  },
];

export const mockActivations: ActivationHistoryItemDto[] = [
  {
    id: "act_101",
    user_id: "usr_alice",
    product_id: "prd_cinema",
    product_name: "Билет в кино",
    activated_at: "2026-10-01T14:30:00Z",
  },
];
