import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "../input";

describe("Input component", () => {
  it("should render input element with data-slot", () => {
    render(<Input placeholder="Введите имя..." />);
    const input = screen.getByPlaceholderText("Введите имя...");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("data-slot", "input");
  });

  it("should accept user typing", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Input placeholder="Поиск" onChange={handleChange} />);

    const input = screen.getByPlaceholderText("Поиск");
    await user.type(input, "Тест");

    expect(handleChange).toHaveBeenCalled();
    expect(input).toHaveValue("Тест");
  });

  it("should be disabled when disabled prop is true", async () => {
    const user = userEvent.setup();
    render(<Input disabled placeholder="Отключено" />);

    const input = screen.getByPlaceholderText("Отключено");
    expect(input).toBeDisabled();
    await user.type(input, "123");
    expect(input).toHaveValue("");
  });

  it("should accept type number and custom attributes", () => {
    render(<Input type="number" min={0} max={100} data-testid="number-input" />);
    const input = screen.getByTestId("number-input");
    expect(input).toHaveAttribute("type", "number");
    expect(input).toHaveAttribute("min", "0");
    expect(input).toHaveAttribute("max", "100");
  });
});
