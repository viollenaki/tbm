const BASE_URL = import.meta.env.VITE_API_URL || "";

export const customClient = async <T>(
  url: string,
  options?: RequestInit,
): Promise<T> => {
  const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;

  const response = await fetch(fullUrl, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let errorPayload: { code?: string; message?: string };
    try {
      errorPayload = await response.json();
    } catch {
      errorPayload = {
        code: "INTERNAL",
        message: response.statusText || "Ошибка при выполнении запроса",
      };
    }
    throw errorPayload;
  }

  const data = await response.json();

  return {
    status: response.status,
    data,
    headers: response.headers,
  } as T;
};

export default customClient;
