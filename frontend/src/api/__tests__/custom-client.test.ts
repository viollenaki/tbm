import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { customClient } from "../mutator/custom-client";

describe("customClient", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should make fetch call with default Content-Type header and relative path", async () => {
    const mockData = { id: 1, name: "Test" };
    const mockHeaders = new Headers({ "content-type": "application/json" });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: mockHeaders,
      json: async () => mockData,
    });
    global.fetch = mockFetch;

    const result = await customClient<{ status: number; data: typeof mockData; headers: Headers }>(
      "/api/test",
      {
        method: "GET",
      },
    );

    const baseUrl = import.meta.env.VITE_API_URL || "";
    expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/api/test`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(result).toEqual({
      status: 200,
      data: mockData,
      headers: mockHeaders,
    });
  });

  it("should respect absolute URLs starting with http", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ ok: true }),
    });
    global.fetch = mockFetch;

    await customClient("https://example.com/api/products");

    expect(mockFetch).toHaveBeenCalledWith("https://example.com/api/products", {
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("should merge custom headers into request options", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ success: true }),
    });
    global.fetch = mockFetch;

    await customClient("/api/custom", {
      headers: {
        Authorization: "Bearer test-token",
        "X-Custom-Header": "value",
      },
    });

    const baseUrl = import.meta.env.VITE_API_URL || "";
    expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/api/custom`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
        "X-Custom-Header": "value",
      },
    });
  });

  it("should throw parsed JSON error payload when response is not ok", async () => {
    const errorPayload = {
      code: "NO_VOUCHERS_LEFT",
      message: "Ваучеры на этот продукт закончились",
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: "Conflict",
      json: async () => errorPayload,
    });
    global.fetch = mockFetch;

    await expect(customClient("/api/activate")).rejects.toEqual(errorPayload);
  });

  it("should throw fallback INTERNAL error if response is not ok and JSON parsing fails", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Server Error",
      json: async () => {
        throw new Error("Invalid JSON");
      },
    });
    global.fetch = mockFetch;

    await expect(customClient("/api/error")).rejects.toEqual({
      code: "INTERNAL",
      message: "Server Error",
    });
  });

  it("should fallback to default error message if statusText is empty on JSON failure", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "",
      json: async () => {
        throw new Error("Invalid JSON");
      },
    });
    global.fetch = mockFetch;

    await expect(customClient("/api/error")).rejects.toEqual({
      code: "INTERNAL",
      message: "Ошибка при выполнении запроса",
    });
  });
});
