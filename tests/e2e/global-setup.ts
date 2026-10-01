import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { chromium, type FullConfig } from "@playwright/test";

/**
 * E2E 用の空のデータベースを用意する（本番ビルドは事前に `npm run build`）。
 * クラウド構成（E2E_MODE=cloud）では Turso 用のセットアップスクリプトでテーブルを作り、ログイン状態を保存する。
 */
export default async function globalSetup(config: FullConfig) {
  const dir = path.join(process.cwd(), "tests", ".e2e");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  if (process.env.E2E_MODE !== "cloud") {
    execSync("npx prisma db push --skip-generate --accept-data-loss", {
      env: { ...process.env, DATABASE_URL: "file:../tests/.e2e/e2e.db" },
      stdio: "pipe",
    });
    return;
  }
  execSync("node --import tsx scripts/turso-setup.ts", {
    env: { ...process.env, TURSO_DATABASE_URL: "file:tests/.e2e/cloud.db", TURSO_AUTH_TOKEN: "" },
    stdio: "pipe",
  });
  // webServer は globalSetup より先に起動しているので、ここでログインしておく
  await saveLogin(config.projects[0].use.baseURL ?? "http://localhost:3100", "e2e-password");
}

/** クラウド構成ではサーバー起動後にログインして Cookie を保存する */
export async function saveLogin(baseURL: string, password: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/login`);
  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL(`${baseURL}/`);
  await page.context().storageState({ path: path.join(process.cwd(), "tests", ".e2e", "auth.json") });
  await browser.close();
}

export type { FullConfig };
