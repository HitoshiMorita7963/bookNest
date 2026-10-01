import { expect, test } from "@playwright/test";

// パスワードログインはクラウド構成（E2E_MODE=cloud）でのみ有効
test.skip(process.env.E2E_MODE !== "cloud", "クラウド構成でのみ実行");
test.use({ storageState: { cookies: [], origins: [] } });

test("未ログインではログイン画面に移動し、API は 401 を返す", async ({ page, request }) => {
  await page.goto("/books");
  await expect(page).toHaveURL(/\/login\?next=%2Fbooks/);
  const res = await request.get("/api/export?format=json");
  expect(res.status()).toBe(401);
  // PWA の静的ファイルはログインなしで取得できる
  expect((await request.get("/manifest.webmanifest")).ok()).toBeTruthy();
});

test("パスワードが違うとエラー、正しければ元のページへ戻る", async ({ page }) => {
  await page.goto("/books");
  await page.getByLabel("パスワード").fill("wrong");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page.getByText("パスワードが違います")).toBeVisible();
  await page.getByLabel("パスワード").fill("e2e-password");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/books$/);
});
