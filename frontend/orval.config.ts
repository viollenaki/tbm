import { defineConfig } from "orval";

export default defineConfig({
  voucherApi: {
    input: "./openapi.json",
    output: {
      mode: "split",
      target: "./src/api/generated/endpoints.ts",
      schemas: "./src/api/generated/models",
      client: "react-query",
      httpClient: "fetch",
      override: {
        mutator: {
          path: "./src/api/mutator/custom-client.ts",
          name: "customClient",
        },
      },
    },
  },
});
