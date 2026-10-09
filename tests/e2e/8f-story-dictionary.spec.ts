import { expect, test } from "@playwright/test";

test("物語要素事典：五十音で引く → 項目の作品例 → 作品名で検索", async ({ page }) => {
  // 基本の創作知識がまだなければ読み込む（8d で読み込み済みのことが多い）
  await page.goto("/creative/knowledge");
  const card = page.getByRole("region", { name: "基本の創作知識" });
  if (await card.count()) {
    await card.getByRole("button").click();
    await expect(card).toHaveCount(0, { timeout: 120_000 });
  }

  await page.getByRole("link", { name: /物語要素事典/ }).click();
  await expect(page).toHaveURL(/\/creative\/knowledge\/dictionary$/);
  await expect(page.getByRole("heading", { name: /物語要素事典/ })).toBeVisible();

  // 「か」行に絞る → 起承転結（きしょうてんけつ）が出る、「た」行の項目は出ない
  await page.getByRole("navigation", { name: "五十音" }).getByRole("link", { name: "か", exact: true }).click();
  await expect(page).toHaveURL(/row=/);
  const kaRow = page.getByRole("region", { name: "か行" });
  await expect(kaRow.getByRole("link", { name: /起承転結/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "た行" })).toHaveCount(0);

  // 項目を開くと、よみと作品例
  await kaRow.getByRole("link", { name: /起承転結/ }).click();
  await expect(page.getByRole("heading", { name: "起承転結" })).toBeVisible();
  await expect(page.getByText("きしょうてんけつ", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("list", { name: "作品例" }).getByText(/4コマ漫画/)).toBeVisible();

  // 作品名で検索すると、その作品が例に載っている項目が見つかる
  await page.goto("/creative/knowledge?q=竹取物語");
  await expect(page.getByRole("link", { name: /^別離/ }).first()).toBeVisible();
});
