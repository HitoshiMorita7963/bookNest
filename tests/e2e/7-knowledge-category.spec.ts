import { expect, test, type Page } from "@playwright/test";

async function createKnowledge(page: Page, title: string, category: string) {
  await page.goto("/knowledge/new");
  await page.getByLabel("タイトル（得た知識・考え方）").fill(title);
  await page.getByLabel("カテゴリ").fill(category);
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(/\/knowledge\/c[a-z0-9]+$/);
}

test("知識のカテゴリをまとめて名前変更・統合できる", async ({ page }) => {
  await createKnowledge(page, "需要と供給", "E2E経済学");
  await createKnowledge(page, "インフレ", "E2E経済");

  await page.goto("/knowledge");
  await expect(page.getByRole("heading", { name: "E2E経済学" })).toBeVisible();
  await page.getByRole("button", { name: "カテゴリ「E2E経済学」の名前を変更" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /^E2E経済 / }).click();
  await expect(dialog.getByText("既にある「E2E経済」（1件）に統合されます")).toBeVisible();
  await dialog.getByRole("button", { name: "統合する" }).click();
  await expect(page.getByText("「E2E経済」に統合しました（1件）")).toBeVisible();

  await expect(page.getByRole("heading", { name: "E2E経済学" })).toHaveCount(0);
  const section = page.locator("details", { has: page.getByRole("heading", { name: "E2E経済", exact: true }) });
  await expect(section.getByText("2件", { exact: true })).toBeVisible();
  await expect(section.getByText("需要と供給")).toBeVisible();
});

test("知識の入力画面でカテゴリを提案して設定できる", async ({ page }) => {
  await page.goto("/knowledge/new");
  await page.getByLabel("タイトル（得た知識・考え方）").fill("コントロールの二分法");
  await page.getByLabel("内容").fill("自分で変えられることと変えられないことを区別する");
  await page.getByLabel("カテゴリ").fill("E2E哲学");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(/\/knowledge\/c[a-z0-9]+$/);

  await page.goto("/knowledge/new");
  await page.getByLabel("タイトル（得た知識・考え方）").fill("受け入れること");
  await page.getByLabel("内容").fill("変えられないことは受け入れ、自分で変えられることに集中する");
  await page.getByRole("button", { name: "カテゴリを提案" }).click();
  await page.getByRole("button", { name: "E2E哲学", exact: true }).click();
  await expect(page.getByLabel("カテゴリ")).toHaveValue("E2E哲学");
});
