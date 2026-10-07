import { expect, test } from "@playwright/test";

/** 読書 → 創作知識（参考にした読書・創作知識として保存・逆引き） */
test("フレーズ・読書メモから創作知識として保存し、逆引きできる", async ({ page }) => {
  // 本と読書メモを用意
  await page.goto("/books/new");
  await page.getByRole("tab", { name: "手入力" }).click();
  await page.getByLabel("タイトル *").fill("E2E銀河の戦記");
  await page.getByLabel("ページ数").fill("300");
  await page.getByRole("radiogroup", { name: "ステータス" }).getByText("積読").click();
  await page.getByRole("button", { name: "本棚に追加" }).click();
  await expect(page).toHaveURL(/\/books\/c[a-z0-9]+$/);
  const bookUrl = page.url();
  await page.getByRole("button", { name: "読み始める" }).click();
  await page.getByRole("button", { name: "進捗更新" }).click();
  await page.getByLabel("現在のページ").fill("120");
  await page.getByLabel("メモ（任意）").fill("E2E敵の名将が主人公を認める場面");
  await page.getByRole("button", { name: "記録する" }).click();
  await expect(page.locator("main").getByText("E2E敵の名将が主人公を認める場面")).toBeVisible();

  // フレーズ →「創作に使う」→ 創作知識タブ → 新しく作る
  await page.goto("/quotes/new");
  await page.getByRole("button", { name: "テキストを入力" }).click();
  await page.getByLabel("フレーズ").fill("E2E敵ながら見事だ");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(/\/quotes\/c[a-z0-9]+$/);
  const quoteUrl = page.url();
  await page.getByRole("button", { name: "創作に使う" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: /創作知識/ }).click();
  await dialog.getByLabel("創作知識のタイトル").fill("E2E好敵手への敬意");
  await dialog.getByLabel("カテゴリ", { exact: true }).selectOption("CHARACTER");
  await dialog.getByLabel("自分の気づき").fill("敵を認める台詞で関係が変わる");
  await dialog.getByLabel("場所（任意）").fill("第10章");
  await dialog.getByRole("button", { name: "創作知識として保存" }).click();
  await expect(page).toHaveURL(/\/creative\/knowledge\/c[a-z0-9]+$/);
  const ckUrl = page.url();
  const refs = page.getByRole("region", { name: "参考にした読書" });
  await expect(refs.getByText("E2E敵ながら見事だ")).toBeVisible();
  await expect(refs.getByText(/第10章/)).toBeVisible();
  await expect(refs.getByText(/敵を認める台詞で関係が変わる/)).toBeVisible();

  // 読書メモ（本の画面）→ 🧠 → 既存の知識につなげる
  await page.goto(bookUrl);
  await page.getByRole("button", { name: "創作知識として保存" }).first().click();
  await dialog.getByRole("tab", { name: "既存の知識につなげる" }).click();
  await dialog.getByLabel("自分の気づき").fill("名将の敬意");
  await dialog.getByLabel("創作知識を検索").fill("E2E好敵手");
  await dialog.getByRole("button", { name: /E2E好敵手への敬意/ }).click();
  await expect(page.getByText("「E2E好敵手への敬意」の参考にしました")).toBeVisible();
  // 本の画面の逆引き（読書メモ経由も含む）
  await expect(page.getByRole("region", { name: "創作への利用" }).getByRole("link", { name: /E2E好敵手への敬意/ })).toBeVisible();

  // 創作知識の画面 → 本棚にない作品をつなげる
  await page.goto(ckUrl);
  await expect(refs.getByText("E2E敵の名将が主人公を認める場面")).toBeVisible();
  await page.getByRole("button", { name: "読書をつなげる" }).click();
  await dialog.getByRole("tab", { name: "本棚にない作品" }).click();
  await dialog.getByLabel("作品名").fill("E2E映画の宿敵");
  await dialog.getByRole("button", { name: "つなげる" }).click();
  await expect(refs.getByText("『E2E映画の宿敵』")).toBeVisible();
  await page.getByRole("button", { name: "『E2E映画の宿敵』とのつながりを解除" }).click();
  await expect(refs.getByText("『E2E映画の宿敵』")).toHaveCount(0);

  // フレーズの画面の逆引き
  await page.goto(quoteUrl);
  await expect(page.getByRole("region", { name: "創作への利用" }).getByRole("link", { name: /E2E好敵手への敬意/ })).toBeVisible();
});
