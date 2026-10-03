import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../card";

describe("Card components", () => {
  it("should render full Card composition with data-slots", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Заголовок карточки</CardTitle>
          <CardDescription>Описание карточки</CardDescription>
        </CardHeader>
        <CardContent>Основное содержимое</CardContent>
        <CardFooter>Нижняя панель</CardFooter>
      </Card>,
    );

    const card = screen.getByText("Заголовок карточки").closest("[data-slot='card']");
    expect(card).toBeInTheDocument();
    expect(screen.getByText("Заголовок карточки")).toHaveAttribute("data-slot", "card-title");
    expect(screen.getByText("Описание карточки")).toHaveAttribute("data-slot", "card-description");
    expect(screen.getByText("Основное содержимое")).toHaveAttribute("data-slot", "card-content");
    expect(screen.getByText("Нижняя панель")).toHaveAttribute("data-slot", "card-footer");
  });

  it("should merge custom classNames", () => {
    render(
      <Card className="custom-card">
        <CardContent className="custom-content">Тест</CardContent>
      </Card>,
    );

    const card = screen.getByText("Тест").closest("[data-slot='card']");
    expect(card?.className).toContain("custom-card");
    expect(screen.getByText("Тест")).toHaveAttribute("class", expect.stringContaining("custom-content"));
  });
});
