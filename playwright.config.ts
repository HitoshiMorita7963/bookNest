import { defineConfig } from "@playwright/test";

/**
 * E2E テスト
 * - 本番ビルドを 3100 番ポートで起動し、専用の DB を使う
 * - E2E_MODE=cloud のときはクラウドと同じ構成（libSQL/Turso アダプタ + パスワードログイン）で実行する
 * - スマートフォン幅（390px）を基準に実行
 */
const PORT = 3100;
const CLOUD = process.env.E2E_MODE === "cloud";
export const E2E_PASSWORD = "e2e-password";

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
    storageState: CLOUD ? "tests/.e2e/auth.json" : undefined,
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/offline`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: CLOUD
      ? { DATABASE_URL: "file:../tests/.e2e/unused.db", TURSO_DATABASE_URL: "file:tests/.e2e/cloud.db", APP_PASSWORD: E2E_PASSWORD, AI_API_KEY: "", OCR_PROVIDER: "tesseract", NEWS_DISABLED: "1" }
      : { DATABASE_URL: "file:../tests/.e2e/e2e.db", TURSO_DATABASE_URL: "", APP_PASSWORD: "", AI_API_KEY: "", OCR_PROVIDER: "tesseract", NEWS_DISABLED: "1" },
  },
});
