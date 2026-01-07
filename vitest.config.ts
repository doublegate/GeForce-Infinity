import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts", "tests/**/*.test.ts"],
    exclude: ["node_modules", "dist", "builds"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules",
        "dist",
        "builds",
        "**/*.d.ts",
        "**/*.config.*",
        "**/types.ts",
      ],
    },
  },
});
