import { expect, test, type Page } from "@playwright/test";

/** 人物相関図：人物と関係を登録すると、人物タブに相関図が出る（スマートフォン幅） */

async function addCharacter(page: Page, name: string, role: string) {
  await page.getByRole("button", { name: "人物", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("名前 *", { exact: true }).fill(name);
  await dialog.getByLabel("役割", { exact: true }).fill(role);
  await dialog.getByRole("button", { name: "追加する" }).click();
  await expect(page.getByRole("link", { name: new RegExp(name) }).first()).toBeVisible();
}

async function addRelation(page: Page, from: string, to: string, label: string, notes = "") {
  await page.getByRole("button", { name: "関係", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("人物", { exact: true }).selectOption({ label: from });
  // 候補にあれば候補のボタンで選ぶ（分類ごとに並ぶ）、なければ自由入力
  const chip = dialog.getByRole("group", { name: "関係の候補" }).getByRole("button", { name: label, exact: true });
  if (await chip.count()) {
    await chip.first().click();
    await expect(dialog.getByLabel("関係 *", { exact: true })).toHaveValue(label);
  } else await dialog.getByLabel("関係 *", { exact: true }).fill(label);
  await dialog.getByLabel("相手", { exact: true }).selectOption({ label: to });
  if (notes) await dialog.getByLabel("メモ", { exact: true }).fill(notes);
  await dialog.getByRole("button", { name: "追加する" }).click();
  await expect(dialog).toHaveCount(0);
}

test("人物相関図：関係を登録 → 相関図に人物と関係 → タップで詳細", async ({ page }) => {
  await page.goto("/creative/projects/new");
  await page.getByLabel("作品タイトル *").fill("春の駅の物語");
  await page.getByRole("button", { name: "作品を作る" }).click();
  await expect(page).toHaveURL(/\/creative\/projects\/c[a-z0-9]+$/);
  await page.getByRole("navigation", { name: "作品のメニュー" }).getByRole("link", { name: "👤 人物" }).click();

  await addCharacter(page, "ソラ", "主人公");
  await addCharacter(page, "ナギ", "ヒロイン");
  // 関係がないうちは相関図を出さない
  await expect(page.getByRole("heading", { name: /相関図/ })).toHaveCount(0);

  await addRelation(page, "ソラ", "ナギ", "片思い", "春の駅で出会ってから");
  await addRelation(page, "ナギ", "ソラ", "幼馴染");
  // 候補にない関係は自由に入力できる
  await addRelation(page, "ソラ", "ナギ", "春の駅の約束");

  const map = page.getByRole("img", { name: "人物相関図（2人・3件の関係）" });
  await expect(map).toBeVisible();
  await expect(map.getByRole("button", { name: "ソラ（主人公）" })).toBeVisible();

  // 関係をタップ → だれからだれへ、とメモ
  await map.getByRole("button", { name: "ソラ → ナギ：片思い・春の駅の約束" }).dispatchEvent("pointerup");
  const detail = page.getByRole("region", { name: "関係の詳細" });
  await expect(detail).toContainText("片思い");
  await expect(detail).toContainText("春の駅で出会ってから");

  // 人物をタップ → その人の関係の一覧と、人物ページへのリンク
  await map.getByRole("button", { name: "ナギ（ヒロイン）" }).dispatchEvent("pointerup");
  const panel = page.getByRole("region", { name: "ナギの関係" });
  await expect(panel).toContainText("幼馴染");
  await expect(panel).toContainText("片思い");
  await panel.getByRole("link", { name: "開く" }).click();
  await expect(page.getByRole("heading", { name: /ナギ/ })).toBeVisible();
});
