import { expect, test } from "@playwright/test";

test("創作知識：作成 → 詳細 → 編集 → 削除", async ({ page }) => {
  // 創作ハブから入る
  await page.goto("/creative");
  await page.getByRole("link", { name: /創作知識/ }).click();
  await expect(page).toHaveURL(/\/creative\/knowledge$/);
  await expect(page.getByRole("link", { name: /トロープ・定番/ })).toBeVisible();

  // 作成
  await page.getByRole("link", { name: "追加", exact: true }).click();
  await page.getByLabel("タイトル *").fill("E2E敵から味方へ");
  await page.getByLabel("カテゴリ *").selectOption("TROPE");
  await page.getByRole("button", { name: "キャラクター", exact: true }).click();
  await page.getByLabel("概要").fill("敵対していた人物が主人公側に加わる展開。");
  await page.getByLabel("物語上の効果").fill("意外性\n人間関係の変化");
  await page.getByLabel("感情・展開の流れ").fill("敵対\n疑念\n信頼");
  await page.getByLabel("タグ").fill("成長、E2Eタグ");
  await page.getByLabel("別名・言い換え").fill("敵が仲間になる");
  await page.getByRole("button", { name: "創作知識を保存" }).click();
  await expect(page).toHaveURL(/\/creative\/knowledge\/c[a-z0-9]+$/);

  // 詳細
  await expect(page.getByRole("heading", { name: "E2E敵から味方へ" })).toBeVisible();
  await expect(page.getByText("人間関係の変化")).toBeVisible();
  await expect(page.getByRole("list", { name: "流れ" }).getByText("疑念")).toBeVisible();
  await expect(page.getByRole("link", { name: /キャラクター/ })).toBeVisible();

  // タグ・カテゴリ・別名で見つかる
  await page.goto("/creative/knowledge?tag=E2Eタグ");
  await expect(page.getByRole("link", { name: "E2E敵から味方へ" })).toBeVisible();
  await page.goto("/creative/knowledge?category=CHARACTER");
  await expect(page.getByRole("link", { name: "E2E敵から味方へ" })).toBeVisible();
  await page.goto("/creative/knowledge?q=仲間になる");
  await page.getByRole("link", { name: "E2E敵から味方へ" }).click();

  // 編集
  await page.getByRole("button", { name: "創作知識の操作" }).click();
  await page.getByRole("menuitem", { name: "編集" }).click();
  await page.getByLabel("タイトル *").fill("E2E敵から味方へ（改）");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByRole("heading", { name: "E2E敵から味方へ（改）" })).toBeVisible();

  // 削除
  await page.getByRole("button", { name: "創作知識の操作" }).click();
  await page.getByRole("menuitem", { name: "削除" }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await expect(page).toHaveURL(/\/creative\/knowledge$/);
  await expect(page.getByText("創作知識を削除しました")).toBeVisible();
  await expect(page.getByRole("link", { name: /E2E敵から味方へ/ })).toHaveCount(0);
});
