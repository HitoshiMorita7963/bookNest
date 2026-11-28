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

test("フレーズは同じ画面で編集でき、保存せずに知識とつなげられる（編集中の内容は消えない）", async ({ page }) => {
  await createKnowledge(page, "編集中につなぐ知識");
  const quoteUrl = await createQuote(page, "編集中につなぐフレーズ");

  // 以前の編集画面の URL は、フレーズの画面の編集に転送される
  await page.goto(`${quoteUrl}/edit`);
  await expect(page).toHaveURL(`${quoteUrl}?edit=1`);
  await page.getByRole("link", { name: "キャンセル" }).click();
  await expect(page).toHaveURL(quoteUrl);

  // メニューの「編集」で、同じ画面の上の部分が入力欄に変わる
  await page.getByRole("button", { name: "その他の操作" }).click();
  await page.getByRole("menuitem", { name: "編集" }).click();
  await expect(page).toHaveURL(`${quoteUrl}?edit=1`);
  await expect(page.getByRole("heading", { name: "フレーズを編集" })).toBeVisible();
  await page.getByLabel("自分のメモ（なぜ残したのか）").fill("まだ保存していないメモ");

  // 編集画面の「関連する知識」からつなげる → その場で保存される
  const section = page.getByRole("region", { name: "関連する知識" });
  await section.getByRole("button", { name: "知識とつなげる" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("知識を検索").fill("編集中につなぐ");
  await dialog.getByRole("button", { name: /編集中につなぐ知識/ }).click();
  await expect(page.getByText("知識とつなげました")).toBeVisible();
  await expect(section.getByRole("link", { name: /編集中につなぐ知識/ })).toBeVisible();
  // 編集画面では、知識の作成画面へ移る「新規」は出さない（編集中の内容が消えるため）
  await expect(section.getByRole("link", { name: "新規" })).toHaveCount(0);
  // 入力中のメモはそのまま
  await expect(page.getByLabel("自分のメモ（なぜ残したのか）")).toHaveValue("まだ保存していないメモ");

  // 「更新する」は、関連する知識・創作への利用の下、削除ボタンのすぐ上にある
  const update = page.getByRole("button", { name: "更新する" });
  const [updateBox, creativeBox, deleteBox] = await Promise.all([
    update.boundingBox(),
    page.getByRole("region", { name: "創作への利用" }).boundingBox(),
    page.getByRole("button", { name: "このフレーズを削除" }).boundingBox(),
  ]);
  expect(updateBox!.y).toBeGreaterThan(creativeBox!.y);
  expect(updateBox!.y).toBeLessThan(deleteBox!.y);

  // 更新すると、同じ画面の表示に戻り、メモも知識のつながりも出ている
  await update.click();
  await expect(page).toHaveURL(quoteUrl);
  await expect(page.getByRole("heading", { name: "フレーズ", exact: true })).toBeVisible();
  await expect(page.getByText("まだ保存していないメモ")).toBeVisible();
  await expect(page.getByRole("region", { name: "関連する知識" }).getByRole("link", { name: /編集中につなぐ知識/ })).toBeVisible();
});

test("新しいフレーズの登録画面で知識と「創作に使う」を選び、保存と一緒につなげられる", async ({ page }) => {
  await createKnowledge(page, "登録時につなぐ知識");
  await createKnowledge(page, "選んで外す知識");
  await page.goto("/creative/projects/new");
  await page.getByLabel("作品タイトル *").fill("登録時の作品");
  await page.getByRole("button", { name: "作品を作る" }).click();
  await expect(page).toHaveURL(/\/creative\/projects\/c[a-z0-9]+$/);

  await page.goto("/quotes/new");
  await page.getByRole("button", { name: "テキストを入力" }).click();
  await page.getByLabel("フレーズ").fill("登録時につなぐフレーズ");
  const section = page.getByRole("region", { name: "関連する知識" });
  const dialog = page.getByRole("dialog");
  for (const title of ["登録時につなぐ知識", "選んで外す知識"]) {
    await section.getByRole("button", { name: "知識とつなげる" }).click();
    await dialog.getByLabel("知識を検索").fill(title);
    await dialog.getByRole("button", { name: new RegExp(title) }).click();
    await expect(dialog).toHaveCount(0);
    await expect(section.getByText(title)).toBeVisible();
  }
  // 選んだものは外せる（まだ保存していない）
  await section.getByRole("button", { name: "「選んで外す知識」を外す" }).click();
  await expect(section.getByText("選んで外す知識")).toHaveCount(0);

  // 創作に使う：作品に関連付け ＋ 創作メモを作る（どちらも保存時に反映）
  const creative = page.getByRole("region", { name: "創作への利用" });
  await creative.getByRole("button", { name: "創作に使う" }).click();
  await dialog.getByRole("tab", { name: /作品に関連付け/ }).click();
  await dialog.getByLabel("作品", { exact: true }).selectOption({ label: "登録時の作品" });
  await dialog.getByRole("button", { name: "会話" }).click();
  await dialog.getByRole("button", { name: "関連付ける（保存時）" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(creative).toContainText("登録時の作品 ／ 作品全体（会話）");

  await creative.getByRole("button", { name: "創作に使う" }).click();
  await dialog.getByRole("radio", { name: /設定/ }).click();
  await dialog.getByLabel("タイトル", { exact: true }).fill("登録時に作るメモ");
  await dialog.getByRole("button", { name: "創作メモを作る（保存時）" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(creative).toContainText("登録時に作るメモ");

  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(/\/quotes\/c[a-z0-9]+$/);
  const saved = page.getByRole("region", { name: "関連する知識" });
  await expect(saved.getByRole("link", { name: /登録時につなぐ知識/ })).toBeVisible();
  await expect(saved.getByText("選んで外す知識")).toHaveCount(0);
  const usage = page.getByRole("region", { name: "創作への利用" });
  await expect(usage.getByRole("link", { name: "✍️ 登録時の作品" })).toBeVisible();
  await expect(usage).toContainText("会話");
  await expect(usage.getByText("登録時に作るメモ")).toBeVisible();
});
