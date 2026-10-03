import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { App } from "../App";
import { renderWithProviders } from "../test/test-utils";

// Mock subpages to isolate App routing and toast manager behavior
vi.mock("../pages/UserPortalPage", () => ({
  UserPortalPage: ({
    navigate,
    addToast,
  }: {
    navigate: (to: string) => void;
    addToast: (type: "success" | "error" | "info", title: string, message: string) => void;
  }) => (
    <div data-testid="user-portal-page">
      <h1>Портал пользователя</h1>
      <button onClick={() => navigate("/admin")}>Перейти в админку</button>
      <button onClick={() => addToast("success", "Успех", "Операция выполнена успешно")}>
        Показать успех
      </button>
      <button onClick={() => addToast("error", "Ошибка", "Произошел сбой")}>
        Показать ошибку
      </button>
      <button onClick={() => addToast("info", "Инфо", "Информационное сообщение")}>
        Показать инфо
      </button>
    </div>
  ),
}));

vi.mock("../pages/AdminPage", () => ({
  AdminPage: ({
    navigate,
  }: {
    navigate: (to: string) => void;
    addToast: (type: "success" | "error" | "info", title: string, message: string) => void;
  }) => (
    <div data-testid="admin-page">
      <h1>Панель администратора</h1>
      <button onClick={() => navigate("/")}>Назад в портал</button>
    </div>
  ),
}));

describe("App component routing and toast system", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render UserPortalPage by default for root route", () => {
    renderWithProviders(<App />);
    expect(screen.getByTestId("user-portal-page")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-page")).not.toBeInTheDocument();
  });

  it("should render AdminPage when initial path is /admin", () => {
    window.history.pushState({}, "", "/admin");
    renderWithProviders(<App />);
    expect(screen.getByTestId("admin-page")).toBeInTheDocument();
    expect(screen.queryByTestId("user-portal-page")).not.toBeInTheDocument();
  });

  it("should navigate from UserPortalPage to AdminPage and back", () => {
    renderWithProviders(<App />);

    expect(screen.getByTestId("user-portal-page")).toBeInTheDocument();

    // Click navigate to admin
    fireEvent.click(screen.getByRole("button", { name: "Перейти в админку" }));
    expect(screen.getByTestId("admin-page")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/admin");

    // Click navigate back
    fireEvent.click(screen.getByRole("button", { name: "Назад в портал" }));
    expect(screen.getByTestId("user-portal-page")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("should handle browser popstate event", () => {
    renderWithProviders(<App />);
    expect(screen.getByTestId("user-portal-page")).toBeInTheDocument();

    // Trigger popstate to /admin
    window.history.pushState({}, "", "/admin");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(screen.getByTestId("admin-page")).toBeInTheDocument();
  });

  it("should display success, error, and info toasts", () => {
    renderWithProviders(<App />);

    // Trigger success toast
    fireEvent.click(screen.getByRole("button", { name: "Показать успех" }));
    expect(screen.getByText("Успех")).toBeInTheDocument();
    expect(screen.getByText("Операция выполнена успешно")).toBeInTheDocument();

    // Trigger error toast
    fireEvent.click(screen.getByRole("button", { name: "Показать ошибку" }));
    expect(screen.getByText("Ошибка")).toBeInTheDocument();
    expect(screen.getByText("Произошел сбой")).toBeInTheDocument();

    // Trigger info toast
    fireEvent.click(screen.getByRole("button", { name: "Показать инфо" }));
    expect(screen.getByText("Инфо")).toBeInTheDocument();
    expect(screen.getByText("Информационное сообщение")).toBeInTheDocument();
  });

  it("should close toast when dismiss button is clicked", () => {
    renderWithProviders(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Показать успех" }));
    expect(screen.getByText("Успех")).toBeInTheDocument();

    // Find and click the close button on the toast
    const closeButton = screen
      .getByText("Успех")
      .closest("div[class*='pointer-events-auto']")
      ?.querySelector("button");
    expect(closeButton).toBeInTheDocument();
    if (closeButton) {
      fireEvent.click(closeButton);
    }

    expect(screen.queryByText("Успех")).not.toBeInTheDocument();
  });

  it("should automatically dismiss toast after 5000ms timeout", () => {
    vi.useFakeTimers();
    renderWithProviders(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Показать успех" }));
    expect(screen.getByText("Успех")).toBeInTheDocument();

    // Advance timers by 5000ms
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText("Успех")).not.toBeInTheDocument();
  });
});
