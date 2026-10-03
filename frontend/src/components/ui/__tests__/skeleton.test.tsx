import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "../skeleton";

describe("Skeleton component", () => {
  it("should render with data-slot skeleton and animate-pulse class", () => {
    const { container } = render(<Skeleton className="w-12 h-6" />);
    const skeleton = container.querySelector('[data-slot="skeleton"]');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton?.className).toContain("animate-pulse");
    expect(skeleton?.className).toContain("w-12");
    expect(skeleton?.className).toContain("h-6");
  });
});
