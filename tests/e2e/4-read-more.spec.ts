import { expect, test } from "@playwright/test";

const LONG = Array.from({ length: 9 }, (_, i) => `長いフレーズの${i + 1}行目です。`).join("\n");

test("5行を超えるフレーズは「もっと見る」で全文を開ける", async ({ page }) => {
  await page.goto("/quotes/new");
  await page.getByRole("button", { name: "テキストを入力" }).click();
  await page.getByLabel("フレーズ").fill(LONG);
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(/\/quotes\/c[a-z0-9]+$/);

  await page.goto("/quotes/new");
  await page.getByRole("button", { name: "テキストを入力" }).click();
  await page.getByLabel("フレーズ").fill("短いフレーズ（折りたたまない）");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(/\/quotes\/c[a-z0-9]+$/);

  await page.goto("/quotes?q=フレーズ");
  const longCard = page.locator("article").filter({ hasText: "長いフレーズの1行目" });
  const shortCard = page.locator("article").filter({ hasText: "短いフレーズ（折りたたまない）" });
  await expect(shortCard.getByRole("button", { name: "もっと見る" })).toHaveCount(0);
  const more = longCard.getByRole("button", { name: "もっと見る" });
  await expect(more).toBeVisible();
  const quote = longCard.locator("blockquote");
  const closedHeight = (await quote.boundingBox())!.height;
  await more.click();
  // 開いてもページは移動しない
  await expect(page).toHaveURL(/\/quotes\?q=/);
  await expect(longCard.getByRole("button", { name: "閉じる" })).toBeVisible();
  expect((await quote.boundingBox())!.height).toBeGreaterThan(closedHeight + 40);
  await longCard.getByRole("button", { name: "閉じる" }).click();
  await expect(longCard.getByRole("button", { name: "もっと見る" })).toBeVisible();
});
