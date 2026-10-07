import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 375, height: 812 } });

test("創作知識への導線：その他メニュー・＋メニュー", async ({ page }) => {
  // その他メニュー → 創作知識
  await page.goto("/");
  await page.getByRole("navigation", { name: "ボトムナビゲーション" }).getByRole("link", { name: "その他" }).click();
  await expect(page).toHaveURL(/\/more$/);
  await page.getByRole("link", { name: "創作知識" }).click();
  await expect(page).toHaveURL(/\/creative\/knowledge$/);
  await expect(page.getByRole("heading", { name: /創作知識/ }).first()).toBeVisible();

  // ＋メニュー → 創作知識の作成
  await page.getByRole("button", { name: "追加メニューを開く" }).click();
  await page.getByRole("dialog").getByRole("link", { name: /創作知識/ }).click();
  await expect(page).toHaveURL(/\/creative\/knowledge\/new$/);
  await expect(page.getByLabel("タイトル *")).toBeVisible();

  // ページ全体が横にスクロールしない
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
});
