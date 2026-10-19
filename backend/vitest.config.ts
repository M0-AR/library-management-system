import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: "./test/setup/global-setup.ts",
    fileParallelism: false,
    pool: "forks",
    testTimeout: 30_000,
    hookTimeout: 120_000,
    include: ["test/**/*.spec.ts"],
    reporters: ["default"],
  },
});
