import { describe, it, expect } from "vitest";
import { cn } from "../utils";

describe("cn utility function", () => {
  it("should merge simple class names", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("should handle conditional and falsy class names", () => {
    expect(cn("btn", false && "hidden", null, undefined, "active")).toBe("btn active");
  });

  it("should resolve tailwind class conflicts correctly", () => {
    // twMerge resolves p-4 overriding p-2
    expect(cn("p-2", "p-4")).toBe("p-4");
    // resolves text color conflict
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("should handle arrays and nested objects", () => {
    expect(cn(["flex", "items-center"], { "bg-red-500": true, "text-white": false })).toBe(
      "flex items-center bg-red-500",
    );
  });

  it("should handle empty arguments", () => {
    expect(cn()).toBe("");
  });
});
