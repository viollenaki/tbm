import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "../badge";

describe("Badge component", () => {
  it("should render badge with text", () => {
    render(<Badge>5 шт.</Badge>);
    expect(screen.getByText("5 шт.")).toBeInTheDocument();
  });

  it("should apply variant styles correctly", () => {
    const { rerender } = render(<Badge variant="secondary">Вторичный</Badge>);
    let badge = screen.getByText("Вторичный");
    expect(badge.className).toContain("bg-secondary");

    rerender(<Badge variant="success">Успех</Badge>);
    badge = screen.getByText("Успех");
    expect(badge.className).toContain("text-emerald-700");

    rerender(<Badge variant="warning">Предупреждение</Badge>);
    badge = screen.getByText("Предупреждение");
    expect(badge.className).toContain("text-amber-700");

    rerender(<Badge variant="destructive">Ошибка</Badge>);
    badge = screen.getByText("Ошибка");
    expect(badge.className).toContain("bg-destructive");

    rerender(<Badge variant="outline">Контур</Badge>);
    badge = screen.getByText("Контур");
    expect(badge.className).toContain("text-foreground");
  });

  it("should merge custom classNames", () => {
    render(<Badge className="font-mono custom-badge">Тест</Badge>);
    const badge = screen.getByText("Тест");
    expect(badge.className).toContain("custom-badge");
    expect(badge.className).toContain("font-mono");
  });
});
