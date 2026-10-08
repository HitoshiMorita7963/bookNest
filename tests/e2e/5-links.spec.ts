import { expect, test, type Page } from "@playwright/test";

async function createQuote(page: Page, text: string) {
  await page.goto("/quotes/new");
  await page.getByRole("button", { name: "テキストを入力" }).click();
  await page.getByLabel("フレーズ").fill(text);
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(/\/quotes\/c[a-z0-9]+$/);
  return page.url();
}

async function createKnowledge(page: Page, title: string) {
  await page.goto("/knowledge/new");
  await page.getByLabel("タイトル（得た知識・考え方）").fill(title);
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(/\/knowledge\/c[a-z0-9]+$/);
  return page.url();
}

test("フレーズと知識をあとから関連付け・解除できる", async ({ page }) => {
  const knowledgeUrl = await createKnowledge(page, "あとからつなぐ知識");
  const quoteUrl = await createQuote(page, "あとからつなぐフレーズ");

  // フレーズ詳細 → 既存の知識とつなげる
  await page.getByRole("button", { name: "知識とつなげる" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("知識を検索").fill("あとからつなぐ");
  await dialog.getByRole("button", { name: /あとからつなぐ知識/ }).click();
  await expect(page.getByText("知識とつなげました")).toBeVisible();
  await expect(page.getByRole("link", { name: /あとからつなぐ知識/ })).toBeVisible();

  // 知識詳細にも「元になったフレーズ」として表示される → 解除
  await page.goto(knowledgeUrl);
  await expect(page.getByText("“あとからつなぐフレーズ”")).toBeVisible();
  await page.getByRole("button", { name: "関連付けを解除" }).click();
  await expect(page.getByText("関連付けを解除しました")).toBeVisible();
  await expect(page.getByText("“あとからつなぐフレーズ”")).toHaveCount(0);

  // 知識詳細 → フレーズを追加
  await page.getByRole("button", { name: "フレーズを追加" }).click();
  await dialog.getByLabel("フレーズ・本のタイトルで検索").fill("あとからつなぐ");
  await dialog.getByRole("button", { name: /あとからつなぐフレーズ/ }).click();
  await expect(page.getByText("フレーズを追加しました")).toBeVisible();
  await expect(page.getByText("“あとからつなぐフレーズ”")).toBeVisible();

  await page.goto(quoteUrl);
  await expect(page.getByRole("link", { name: /あとからつなぐ知識/ })).toBeVisible();

  // フレーズ一覧のカードにも、つながっている知識が表示される（押すと知識へ）
  await page.goto("/quotes?q=あとからつなぐ");
  const card = page.locator("article", { hasText: "あとからつなぐフレーズ" });
  await card.getByRole("list", { name: "つながっている知識" }).getByRole("link", { name: "🧠 あとからつなぐ知識" }).click();
  await expect(page).toHaveURL(knowledgeUrl);
  // 知識の画面のフレーズカードでは、その知識自身は繰り返さない
  await expect(page.getByRole("list", { name: "つながっている知識" })).toHaveCount(0);
});

test("創作への利用をフレーズ側から解除できる", async ({ page }) => {
  await createQuote(page, "創作で使ってから外すフレーズ");
  await page.getByRole("button", { name: "創作に使う" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: /その他/ }).click();
  await dialog.getByLabel("タイトル", { exact: true }).fill("外す予定のメモ");
  await dialog.getByRole("button", { name: "創作メモを作成" }).click();
  await expect(page).toHaveURL(/\/creative\/notes\/c[a-z0-9]+$/);

  await page.goBack();
  await page.reload();
  const section = page.getByRole("region", { name: "創作への利用" });
  await expect(section.getByText("外す予定のメモ")).toBeVisible();
  await section.getByRole("button", { name: "「外す予定のメモ」との関連付けを解除" }).click();
  await expect(page.getByText("関連付けを解除しました")).toBeVisible();
  await expect(section.getByText("外す予定のメモ")).toHaveCount(0);
});
