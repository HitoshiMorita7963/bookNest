import { expect, test, type Page } from "@playwright/test";

const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "作品のメニュー" }).getByRole("link", { name });

test("創作知識：作品の人物に関連付け → 使用している作品・参考資料に表示 → 作品側から追加", async ({ page }) => {
  // 作品と人物
  await page.goto("/creative/projects/new");
  await page.getByLabel("作品タイトル *").fill("E2E知識の作品");
  await page.getByRole("button", { name: "作品を作る" }).click();
  await expect(page).toHaveURL(/\/creative\/projects\/c[a-z0-9]+$/);
  const projectUrl = new URL(page.url()).pathname;
  await tab(page, "👤 人物").click();
  await page.getByRole("button", { name: "人物" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("名前 *", { exact: true }).fill("E2Eミナ");
  await sheet.getByRole("button", { name: "追加する" }).click();
  await expect(page.getByRole("link", { name: /E2Eミナ/ })).toBeVisible();

  // 創作知識を2つ作る
  for (const title of ["E2E改心する敵", "E2E三幕構成"]) {
    await page.goto("/creative/knowledge/new");
    await page.getByLabel("タイトル *").fill(title);
    await page.getByLabel("カテゴリ *").selectOption(title === "E2E三幕構成" ? "STRUCTURE" : "TROPE");
    await page.getByRole("button", { name: "創作知識を保存" }).click();
    await expect(page).toHaveURL(/\/creative\/knowledge\/c[a-z0-9]+$/);
  }
  const ckUrl = new URL(page.url()).pathname; // E2E三幕構成

  // 知識の画面 → 創作に使う → 人物に関連付け
  await page.goto("/creative/knowledge?q=E2E改心する敵");
  await page.getByRole("link", { name: /E2E改心する敵/ }).first().click();
  await expect(page.getByRole("region", { name: "使用している作品" })).toBeVisible();
  await page.getByRole("button", { name: "創作に使う" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("tab", { name: /作品に関連付け/ })).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByRole("tab", { name: /創作知識/ })).toHaveCount(0);
  await dialog.getByLabel("作品", { exact: true }).selectOption({ label: "E2E知識の作品" });
  await dialog.getByRole("radio", { name: "人物" }).click();
  await expect(dialog.getByLabel("人物", { exact: true })).toHaveValue(/.+/);
  await dialog.getByRole("button", { name: "関連付ける" }).click();
  await expect(page.getByText("作品に関連付けました")).toBeVisible();

  // 逆引き：使用している作品
  const usage = page.getByRole("region", { name: "使用している作品" });
  await expect(usage.getByText("この創作知識を使っている作品・創作メモ")).toBeVisible();
  await expect(usage.getByRole("link", { name: "✍️ E2E知識の作品" })).toBeVisible();
  await usage.getByRole("link", { name: "E2Eミナ" }).click();

  // 人物の画面に参考資料として表示
  await expect(page).toHaveURL(/\/characters\/c[a-z0-9]+$/);
  await expect(page.getByRole("link", { name: /E2E改心する敵/ })).toBeVisible();

  // 作品の参考資料：創作知識の絞り込み
  await page.goto(`${projectUrl}/references`);
  await expect(page.getByRole("link", { name: /🧭 創作知識 1/ })).toBeVisible();

  // 作品側から「資料を追加」→ 創作知識
  await page.getByRole("button", { name: "資料を追加" }).click();
  const picker = page.getByRole("dialog");
  await picker.getByRole("tab", { name: "創作知識" }).click();
  await picker.getByLabel("創作知識を検索").fill("E2E三幕");
  await picker.getByRole("button", { name: /E2E三幕構成/ }).click();
  await picker.getByRole("button", { name: "参考資料に追加" }).click();
  await expect(page.getByText("参考資料を追加しました")).toBeVisible();
  await expect(page.getByRole("link", { name: /🧭 創作知識 2/ })).toBeVisible();

  // 知識の画面にも作品が出る
  await page.goto(ckUrl);
  await expect(page.getByRole("region", { name: "使用している作品" }).getByRole("link", { name: "✍️ E2E知識の作品" })).toBeVisible();
});
