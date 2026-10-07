import { expect, test } from "@playwright/test";

test("創作知識：基本の創作知識を読み込む → カテゴリ・詳細・関連知識・検索", async ({ page }) => {
  await page.goto("/creative/knowledge");
  const card = page.getByRole("region", { name: "基本の創作知識" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: /追加する/ }).click();
  await expect(page.getByText(/件を追加しました/)).toBeVisible();
  // 読み込み後はカードが消える（2回目に重複しない）
  await expect(card).toHaveCount(0);

  // カテゴリ → サブカテゴリでまとまっている
  await page.getByRole("link", { name: /トロープ・定番/ }).first().click();
  await expect(page.getByRole("link", { name: /^敵から味方へ/ }).first()).toBeVisible();

  // 詳細：サンプルの目印・感情の流れ・関連知識
  // サブカテゴリのチップと同じ名前なので、カードのほう（最後）を開く
  await page.getByRole("link", { name: /^敵から味方へ/ }).last().click();
  await expect(page.getByRole("heading", { name: "敵から味方へ" })).toBeVisible();
  await expect(page.getByRole("list", { name: "流れ" }).getByText("共闘")).toBeVisible();
  const related = page.getByRole("region", { name: "関連知識" });
  await expect(related.getByText("共通の敵")).toBeVisible();
  await expect(page.getByText(/サンプル ・ 作成/)).toBeVisible();

  // 言い換えで検索
  await page.goto("/creative/knowledge?q=敵が仲間になる");
  await expect(page.getByRole("link", { name: /^敵から味方へ/ }).first()).toBeVisible();
});
