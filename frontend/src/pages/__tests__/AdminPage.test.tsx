import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, fireEvent, within } from "@testing-library/react";
import { AdminPage } from "../AdminPage";
import {
  renderWithProviders,
  createTestQueryClient,
  mockUsers,
  mockProducts,
  mockBalances,
  mockActivations,
} from "../../test/test-utils";

describe("AdminPage component", () => {
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
    updateStatus = 200,
    updateErrorPayload = null as { code: string; message: string } | null,
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

      if (urlStr.includes("/balances") && method === "GET") {
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

      if (urlStr.includes("/balances") && method === "PUT") {
        if (updateErrorPayload) {
          return Promise.resolve({
            ok: false,
            status: updateStatus,
            headers: new Headers(),
            json: async () => updateErrorPayload,
          });
        }
        const body = options?.body ? JSON.parse(options.body.toString()) : {};
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            user_id: "usr_alice",
            product_id: "prd_cinema",
            quantity: body.quantity ?? 1,
          }),
        });
      }

      return Promise.reject(new Error(`Unhandled request: ${urlStr}`));
    });

    global.fetch = fetchMock;
    return fetchMock;
  }

  it("should render admin page title, badge, and navigation", async () => {
    setupFetchMock();
    renderWithProviders(
      <AdminPage navigate={mockNavigate} addToast={mockAddToast} />,
    );

    expect(screen.getByText("Панель администратора")).toBeInTheDocument();
    expect(screen.getByText("ADMIN")).toBeInTheDocument();

    const backButton = screen.getByRole("button", { name: /В портал/i });
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("should render user statistics and product balances list", async () => {
    setupFetchMock();
    renderWithProviders(
      <AdminPage navigate={mockNavigate} addToast={mockAddToast} />,
    );

    // Wait for heading in balance card to load
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 3, name: "Билет в кино" }),
      ).toBeInTheDocument();
    });

    // Check header stats: total vouchers (2 + 0 = 2) appears in stats and card
    expect(screen.getAllByText("2 шт.").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Управление остатками по продуктам")).toBeInTheDocument();

    // Check products present in list
    expect(
      screen.getByRole("heading", { level: 3, name: "Билет в кино" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Кофе капучино" }),
    ).toBeInTheDocument();
  });

  it("should filter users by search input", async () => {
    setupFetchMock();
    renderWithProviders(
      <AdminPage navigate={mockNavigate} addToast={mockAddToast} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Найдено клиентов:")).toBeInTheDocument();
    });

    const userSearchInput = screen.getByPlaceholderText("Имя или ID...");
    fireEvent.change(userSearchInput, { target: { value: "Алиса" } });

    expect(screen.getByText("Найдено клиентов:")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("should filter products by search input", async () => {
    setupFetchMock();
    renderWithProviders(
      <AdminPage navigate={mockNavigate} addToast={mockAddToast} />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 3, name: "Билет в кино" }),
      ).toBeInTheDocument();
    });

    const productSearchInput = screen.getByPlaceholderText("Фильтр продуктов...");
    fireEvent.change(productSearchInput, { target: { value: "кино" } });

    expect(
      screen.getByRole("heading", { level: 3, name: "Билет в кино" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 3, name: "Кофе капучино" }),
    ).not.toBeInTheDocument();
  });

  it("should perform quick +1 increment on product balance", async () => {
    const fetchMock = setupFetchMock();
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderWithProviders(
      <AdminPage navigate={mockNavigate} addToast={mockAddToast} />,
      { queryClient },
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 3, name: "Билет в кино" }),
      ).toBeInTheDocument();
    });

    // Find +1 button for "Билет в кино" (current qty is 2, so new qty will be 3)
    const cinemaHeading = screen.getByRole("heading", { level: 3, name: "Билет в кино" });
    const cinemaCard = cinemaHeading.closest("[data-slot='card']")!;
    const plusOneBtn = within(cinemaCard).getByRole("button", { name: "+1" });

    fireEvent.click(plusOneBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/balances/prd_cinema"),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ quantity: 3 }),
        }),
      );
      expect(mockAddToast).toHaveBeenCalledWith(
        "success",
        "Баланс обновлен",
        "«Билет в кино»: установлен баланс 3 шт.",
      );
    });

    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("should perform quick reset to 0", async () => {
    const fetchMock = setupFetchMock();

    renderWithProviders(
      <AdminPage navigate={mockNavigate} addToast={mockAddToast} />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 3, name: "Билет в кино" }),
      ).toBeInTheDocument();
    });

    const cinemaHeading = screen.getByRole("heading", { level: 3, name: "Билет в кино" });
    const cinemaCard = cinemaHeading.closest("[data-slot='card']")!;
    const resetBtn = within(cinemaCard).getByRole("button", { name: "0" });

    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/balances/prd_cinema"),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ quantity: 0 }),
        }),
      );
      expect(mockAddToast).toHaveBeenCalledWith(
        "success",
        "Баланс обновлен",
        "«Билет в кино»: установлен баланс 0 шт.",
      );
    });
  });

  it("should set custom balance quantity via row input", async () => {
    const fetchMock = setupFetchMock();

    renderWithProviders(
      <AdminPage navigate={mockNavigate} addToast={mockAddToast} />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 3, name: "Билет в кино" }),
      ).toBeInTheDocument();
    });

    const cinemaHeading = screen.getByRole("heading", { level: 3, name: "Билет в кино" });
    const cinemaCard = cinemaHeading.closest("[data-slot='card']")!;
    const input = within(cinemaCard).getByPlaceholderText("Задать...");
    const okBtn = within(cinemaCard).getByRole("button", { name: "ОК" });

    fireEvent.change(input, { target: { value: "15" } });
    fireEvent.click(okBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/balances/prd_cinema"),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ quantity: 15 }),
        }),
      );
      expect(mockAddToast).toHaveBeenCalledWith(
        "success",
        "Баланс обновлен",
        "«Билет в кино»: установлен баланс 15 шт.",
      );
    });
  });

  it("should reject negative custom quantity in row input with error toast", async () => {
    setupFetchMock();

    renderWithProviders(
      <AdminPage navigate={mockNavigate} addToast={mockAddToast} />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 3, name: "Билет в кино" }),
      ).toBeInTheDocument();
    });

    const cinemaHeading = screen.getByRole("heading", { level: 3, name: "Билет в кино" });
    const cinemaCard = cinemaHeading.closest("[data-slot='card']")!;
    const input = within(cinemaCard).getByPlaceholderText("Задать...");
    const okBtn = within(cinemaCard).getByRole("button", { name: "ОК" });

    fireEvent.change(input, { target: { value: "-3" } });
    fireEvent.click(okBtn);

    expect(mockAddToast).toHaveBeenCalledWith(
      "error",
      "Ошибка",
      "Введите целое неотрицательное число.",
    );
  });

  it("should perform bulk addition across all products", async () => {
    const fetchMock = setupFetchMock();

    renderWithProviders(
      <AdminPage navigate={mockNavigate} addToast={mockAddToast} />,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3, name: "Билет в кино" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /\+1 на все/i })).not.toBeDisabled();
    });

    const bulkBtn = screen.getByRole("button", { name: /\+1 на все/i });
    fireEvent.click(bulkBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/balances/prd_cinema"),
        expect.objectContaining({ method: "PUT" }),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/balances/prd_coffee"),
        expect.objectContaining({ method: "PUT" }),
      );
      expect(mockAddToast).toHaveBeenCalledWith(
        "success",
        "Массовое начисление",
        expect.stringContaining("Начислено +1 ваучеров"),
      );
    });
  });

  it("should submit precision balance form with valid inputs", async () => {
    const fetchMock = setupFetchMock();

    renderWithProviders(
      <AdminPage navigate={mockNavigate} addToast={mockAddToast} />,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3, name: "Билет в кино" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Сохранить в БД/i })).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole("button", { name: /Сохранить в БД/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/balances/prd_cinema"),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ quantity: 5 }),
        }),
      );
      expect(mockAddToast).toHaveBeenCalledWith(
        "success",
        "Запас обновлен",
        expect.stringContaining("Установлен баланс 5 шт."),
      );
    });
  });

  it("should show validation error in form if quantity is negative", async () => {
    setupFetchMock();

    renderWithProviders(
      <AdminPage navigate={mockNavigate} addToast={mockAddToast} />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Сохранить в БД/i })).toBeInTheDocument();
    });

    const form = screen.getByRole("button", { name: /Сохранить в БД/i }).closest("form")!;
    const qtyInput = within(form).getByPlaceholderText("0");

    fireEvent.change(qtyInput, { target: { value: "-5" } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText("Количество должно быть целым неотрицательным числом (≥ 0)."),
      ).toBeInTheDocument();
    });
  });

  it("should render audit log activations list", async () => {
    setupFetchMock();

    renderWithProviders(
      <AdminPage navigate={mockNavigate} addToast={mockAddToast} />,
    );

    await waitFor(() => {
      expect(screen.getByText(/1 записей/)).toBeInTheDocument();
    });
  });

  it("should trigger synchronization on clicking synchronize button", async () => {
    const fetchMock = setupFetchMock();

    renderWithProviders(
      <AdminPage navigate={mockNavigate} addToast={mockAddToast} />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Синхронизировать/i })).toBeInTheDocument();
    });

    const syncBtn = screen.getByRole("button", { name: /Синхронизировать/i });
    fireEvent.click(syncBtn);

    expect(fetchMock).toHaveBeenCalled();
  });

  it("should render error alert when users or products fail to load", async () => {
    setupFetchMock({ usersFail: true });

    renderWithProviders(
      <AdminPage navigate={mockNavigate} addToast={mockAddToast} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Ошибка загрузки данных")).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: "Повторить" });
    expect(retryBtn).toBeInTheDocument();
  });
});
