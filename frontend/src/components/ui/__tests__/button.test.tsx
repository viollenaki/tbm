import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "../button";

describe("Button component", () => {
  it("should render button with text and data-slot", () => {
    render(<Button>Нажать</Button>);
    const button = screen.getByRole("button", { name: "Нажать" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("data-slot", "button");
    expect(button).toHaveAttribute("data-variant", "default");
    expect(button).toHaveAttribute("data-size", "default");
  });

  it("should handle click events", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Нажать</Button>);

    await user.click(screen.getByRole("button", { name: "Нажать" }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("should not trigger onClick when disabled", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Отключено
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Отключено" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("should apply variant classes and data-variant correctly", () => {
    const { rerender } = render(<Button variant="destructive">Удалить</Button>);
    let button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-variant", "destructive");
    expect(button.className).toContain("text-destructive");

    rerender(<Button variant="outline">Контур</Button>);
    button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-variant", "outline");
    expect(button.className).toContain("border-border");

    rerender(<Button variant="ghost">Призрак</Button>);
    button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-variant", "ghost");
    expect(button.className).toContain("hover:bg-muted");

    rerender(<Button variant="link">Ссылка</Button>);
    button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-variant", "link");
    expect(button.className).toContain("hover:underline");
  });

  it("should apply size classes and data-size correctly", () => {
    const { rerender } = render(<Button size="sm">Маленькая</Button>);
    let button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-size", "sm");
    expect(button.className).toContain("h-7");

    rerender(<Button size="xs">Очень маленькая</Button>);
    button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-size", "xs");
    expect(button.className).toContain("h-6");

    rerender(<Button size="lg">Большая</Button>);
    button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-size", "lg");
    expect(button.className).toContain("h-9");
  });

  it("should merge custom classNames", () => {
    render(<Button className="custom-class">Пользовательская</Button>);
    expect(screen.getByRole("button").className).toContain("custom-class");
  });
});
