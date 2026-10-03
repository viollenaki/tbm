import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Alert, AlertTitle, AlertDescription } from "../alert";

describe("Alert component", () => {
  it("should render alert with role alert and data-slot", () => {
    render(
      <Alert>
        <AlertTitle>Внимание</AlertTitle>
        <AlertDescription>Сообщение об ошибке</AlertDescription>
      </Alert>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute("data-slot", "alert");
    expect(screen.getByText("Внимание")).toHaveAttribute("data-slot", "alert-title");
    expect(screen.getByText("Сообщение об ошибке")).toHaveAttribute(
      "data-slot",
      "alert-description",
    );
  });

  it("should apply destructive variant class", () => {
    render(
      <Alert variant="destructive">
        <AlertTitle>Ошибка</AlertTitle>
      </Alert>,
    );

    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("text-destructive-foreground");
  });

  it("should apply success and warning variant classes", () => {
    const { rerender } = render(
      <Alert variant="success">
        <AlertTitle>Успешно</AlertTitle>
      </Alert>,
    );
    let alert = screen.getByRole("alert");
    expect(alert.className).toContain("text-emerald-800");

    rerender(
      <Alert variant="warning">
        <AlertTitle>Предупреждение</AlertTitle>
      </Alert>,
    );
    alert = screen.getByRole("alert");
    expect(alert.className).toContain("text-amber-800");
  });

  it("should merge custom classNames", () => {
    render(
      <Alert className="my-custom-alert">
        <AlertTitle className="my-title">Заголовок</AlertTitle>
      </Alert>,
    );

    expect(screen.getByRole("alert").className).toContain("my-custom-alert");
    expect(screen.getByText("Заголовок").className).toContain("my-title");
  });
});
