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
