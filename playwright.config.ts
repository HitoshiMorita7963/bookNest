import { defineConfig } from "@playwright/test";

/**
 * E2E テスト
 * - 専用の SQLite（tests/.e2e/e2e.db）を使い、本番ビルドを 3100 番ポートで起動する
 * - スマートフォン幅（390px）を基準に実行
 */
const PORT = 3100;
const DATABASE_URL = "file:../tests/.e2e/e2e.db";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/offline`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: { DATABASE_URL, AI_API_KEY: "", OCR_PROVIDER: "tesseract" },
  },
});
