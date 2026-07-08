import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run dev",
    env: {
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000"
    },
    reuseExistingServer: true,
    url: "http://localhost:3000"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] }
    }
  ]
});
