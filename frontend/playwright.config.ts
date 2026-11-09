import { defineConfig, devices } from "@playwright/test";

const DB = process.env.TEST_DATABASE_URL ?? "postgresql+psycopg://moura:moura@localhost:5433/moura";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  expect: { timeout: process.env.CI ? 10_000 : 5_000 },
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    {
      name: "galaxy-s23",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 780 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
      },
    },
    { name: "iphone-14-pro", use: { ...devices["iPhone 14 Pro"] } },
  ],
  webServer: [
    {
      command: "uv run uvicorn moura_gestao.main:app --port 8000",
      cwd: "../backend",
      url: "http://localhost:8000/api/health",
      reuseExistingServer: !process.env.CI,
      env: {
        DATABASE_URL: DB,
        JWT_SECRET: "e2e-secret-e2e-secret-e2e-secret-123",
        COOKIE_SECURE: "false",
        ENVIRONMENT: "test",
      },
    },
    {
      // No CI usa o build de produção (sem compilação sob demanda, que estourava timeouts).
      command: process.env.CI ? "npm run build && npm run start" : "npm run dev",
      url: "http://localhost:3000/login",
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      env: { API_URL: "http://localhost:8000" },
    },
  ],
});
