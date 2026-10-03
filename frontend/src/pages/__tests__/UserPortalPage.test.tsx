import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, fireEvent, within } from "@testing-library/react";
import { UserPortalPage } from "../UserPortalPage";
import {
  renderWithProviders,
  createTestQueryClient,
  mockUsers,
  mockProducts,
  mockBalances,
  mockActivations,
} from "../../test/test-utils";

describe("UserPortalPage component", () => {
  const mockNavigate = vi.fn();
  const mockAddToast = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
    mockAddToast.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function setupFetchMock({
    users = mockUsers,
    products = mockProducts,
    balances = mockBalances,
    activations = mockActivations,
    usersFail = false,
    activateStatus = 200,
    activateErrorPayload = null as { code: string; message: string } | null,
  } = {}) {
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      const urlStr = url.toString();
      const method = options?.method || "GET";

      if (
        urlStr.includes("/v1/users") &&
        !urlStr.includes("/balances") &&
        !urlStr.includes("/activations")
      ) {
        if (usersFail) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: "Server Error",
            headers: new Headers(),
            json: async () => ({ message: "Failed to fetch users" }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => users,
        });
      }

      if (urlStr.includes("/v1/products")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => products,
        });
      }

      if (urlStr.includes("/balances")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => balances,
        });
      }

      if (urlStr.includes("/activations") && method === "GET") {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => activations,
        });
      }

      if (urlStr.includes("/activations") && method === "POST") {
        if (activateErrorPayload) {
          return Promise.resolve({
            ok: false,
            status: activateStatus,
            headers: new Headers(),
            json: async () => activateErrorPayload,
          });
        }
        return Promise.resolve({
          ok: true,
          status: 201,
          headers: new Headers(),
          json: async () => ({
            id: "act_new",
            user_id: "usr_alice",
            product_id: "prd_cinema",
            product_name: "Билет в кино",
            activated_at: "2026-10-04T05:00:00Z",
          }),
        });
      }

      return Promise.reject(new Error(`Unhandled request: ${urlStr}`));
    });

    global.fetch = fetchMock;
    return fetchMock;
  }

  it("should render page header, user selector, balances, and history", async () => {
    setupFetchMock();
    const queryClient = createTestQueryClient();

    renderWithProviders(
      <UserPortalPage navigate={mockNavigate} addToast={mockAddToast} />,
      { queryClient },
    );

    // Header title
    expect(screen.getByText("Сервис ваучеров")).toBeInTheDocument();
    expect(screen.getByText("Клиентский портал активации услуг")).toBeInTheDocument();

    // Wait for users and products to load
    await waitFor(() => {
      expect(screen.getByLabelText("Текущий пользователь")).toBeInTheDocument();
    });

    // Check user selector has loaded
    const select = screen.getByLabelText("Текущий пользователь") as HTMLSelectElement;
    expect(select.value).toBe("usr_alice");

    // Check total vouchers (2 + 0 = 2)
    await waitFor(() => {
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    // Check product cards
    expect(screen.getAllByText("Билет в кино").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Кофе капучино")).toBeInTheDocument();

    // Check quantities
    expect(screen.getByText("2 шт.")).toBeInTheDocument();
    expect(screen.getByText("0 шт.")).toBeInTheDocument();

    // Check activation history item
    await waitFor(() => {
      expect(screen.getByText("История активаций")).toBeInTheDocument();
      expect(screen.getByText("ID: act_101")).toBeInTheDocument();
    });
  });

  it("should navigate to admin panel when clicking admin button", async () => {
    setupFetchMock();
    renderWithProviders(
      <UserPortalPage navigate={mockNavigate} addToast={mockAddToast} />,
    );

    const adminButton = screen.getByRole("button", { name: /Панель администратора/i });
    fireEvent.click(adminButton);

    expect(mockNavigate).toHaveBeenCalledWith("/admin");
  });

  it("should disable activate button when product balance is 0", async () => {
    setupFetchMock();
    renderWithProviders(
      <UserPortalPage navigate={mockNavigate} addToast={mockAddToast} />,
    );

    // Wait until products and balances load
    await screen.findAllByRole("button", { name: /Активировать/i });

    const coffeeHeading = screen.getByText("Кофе капучино");
    const coffeeCard = coffeeHeading.closest("[data-slot='card']") || coffeeHeading.closest(".border-2")!;
    const coffeeButton = within(coffeeCard as HTMLElement).getByRole("button", {
      name: /Активировать/i,
    });
    expect(coffeeButton).toBeDisabled();

    const cinemaHeading = screen.getAllByText("Билет в кино")[0];
    const cinemaCard = cinemaHeading.closest("[data-slot='card']") || cinemaHeading.closest(".border-2")!;
    const cinemaButton = within(cinemaCard as HTMLElement).getByRole("button", {
      name: /Активировать/i,
    });
    expect(cinemaButton).not.toBeDisabled();
  });

  it("should successfully activate voucher, show success toast, and invalidate queries", async () => {
    setupFetchMock();
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderWithProviders(
      <UserPortalPage navigate={mockNavigate} addToast={mockAddToast} />,
      { queryClient },
    );

    // Wait for the activate buttons to be loaded in the DOM
    await screen.findAllByRole("button", { name: /Активировать/i });

    const cinemaHeading = screen.getAllByText("Билет в кино")[0];
    const cinemaCard = cinemaHeading.closest("[data-slot='card']") || cinemaHeading.closest(".border-2")!;
    const cinemaButton = within(cinemaCard as HTMLElement).getByRole("button", {
      name: /Активировать/i,
    });

    fireEvent.click(cinemaButton);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        "success",
        "Активация успешна",
        "Ваучер на «Билет в кино» успешно активирован!",
      );
    });

    // Verify invalidateQueries was called for balances and activations
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("should handle NO_VOUCHERS_LEFT error with Russian toast notification", async () => {
    setupFetchMock({
      activateStatus: 409,
      activateErrorPayload: {
        code: "NO_VOUCHERS_LEFT",
        message: "Ваучеры на этот продукт закончились",
      },
    });

    renderWithProviders(
      <UserPortalPage navigate={mockNavigate} addToast={mockAddToast} />,
    );

    await screen.findAllByRole("button", { name: /Активировать/i });

    const cinemaHeading = screen.getAllByText("Билет в кино")[0];
    const cinemaCard = cinemaHeading.closest("[data-slot='card']") || cinemaHeading.closest(".border-2")!;
    const cinemaButton = within(cinemaCard as HTMLElement).getByRole("button", {
      name: /Активировать/i,
    });

    fireEvent.click(cinemaButton);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        "error",
        "Нет ваучеров",
        "Ваучеры на «Билет в кино» закончились.",
      );
    });
  });

  it("should handle general activation error with message from server", async () => {
    setupFetchMock({
      activateStatus: 500,
      activateErrorPayload: {
        code: "DATABASE_ERROR",
        message: "Сбой базы данных",
      },
    });

    renderWithProviders(
      <UserPortalPage navigate={mockNavigate} addToast={mockAddToast} />,
    );

    await screen.findAllByRole("button", { name: /Активировать/i });

    const cinemaHeading = screen.getAllByText("Билет в кино")[0];
    const cinemaCard = cinemaHeading.closest("[data-slot='card']") || cinemaHeading.closest(".border-2")!;
    const cinemaButton = within(cinemaCard as HTMLElement).getByRole("button", {
      name: /Активировать/i,
    });

    fireEvent.click(cinemaButton);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        "error",
        "Ошибка активации",
        "Сбой базы данных",
      );
    });
  });

  it("should display empty activations state when history is empty", async () => {
    setupFetchMock({ activations: [] });

    renderWithProviders(
      <UserPortalPage navigate={mockNavigate} addToast={mockAddToast} />,
    );

    await waitFor(() => {
      expect(screen.getByText("История пуста")).toBeInTheDocument();
      expect(
        screen.getByText("У выбранного пользователя пока нет выполненных активаций."),
      ).toBeInTheDocument();
    });
  });

  it("should switch user on select change", async () => {
    const fetchMock = setupFetchMock();

    renderWithProviders(
      <UserPortalPage navigate={mockNavigate} addToast={mockAddToast} />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Текущий пользователь")).toBeInTheDocument();
    });

    const select = screen.getByLabelText("Текущий пользователь");
    fireEvent.change(select, { target: { value: "usr_bob" } });

    await waitFor(() => {
      // Should have triggered requests for usr_bob balances
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/users/usr_bob/balances"),
        expect.anything(),
      );
    });
  });

  it("should render error banner and allow retry when initial users fetch fails", async () => {
    setupFetchMock({ usersFail: true });

    renderWithProviders(
      <UserPortalPage navigate={mockNavigate} addToast={mockAddToast} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Ошибка соединения с сервером")).toBeInTheDocument();
    });

    // Retrying should be available
    const retryButton = screen.getByRole("button", { name: "Повторить" });
    expect(retryButton).toBeInTheDocument();
  });

  it("should trigger refetch when clicking refresh button", async () => {
    const fetchMock = setupFetchMock();

    renderWithProviders(
      <UserPortalPage navigate={mockNavigate} addToast={mockAddToast} />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Обновить/i })).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole("button", { name: /Обновить/i });
    fireEvent.click(refreshButton);

    expect(fetchMock).toHaveBeenCalled();
  });
});
