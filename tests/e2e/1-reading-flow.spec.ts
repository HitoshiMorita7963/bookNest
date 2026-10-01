import { expect, test } from "@playwright/test";

/**
 * アプリ起動 → 本を追加 → 本棚確認 → 本詳細 → 読書開始 → 進捗更新 → フレーズ保存 → 読了 → 統計確認
 */
test("読書の一連の流れ（スマートフォン）", async ({ page }) => {
  // アプリ起動：データが無い状態の空状態
  await page.goto("/");
  await expect(page.getByText("まだ本がありません。")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "ボトムナビゲーション" })).toBeVisible();

  // 本を追加（手入力）
  await page.getByRole("link", { name: "本を追加" }).first().click();
  await expect(page).toHaveURL(/\/books\/new/);
  await page.getByRole("tab", { name: "手入力" }).click();
  await page.getByLabel("タイトル *").fill("E2Eテストの本");
  await page.getByLabel("著者").fill("テスト 太郎");
  await page.getByLabel("ページ数").fill("300");
  await page.getByRole("radiogroup", { name: "ステータス" }).getByText("所有").click();
  await page.getByLabel("タグ").fill("テスト、読書");
  await page.getByRole("button", { name: "本棚に追加" }).click();
  await expect(page).toHaveURL(/\/books\/c[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: "E2Eテストの本" }).first()).toBeVisible();

  // 本棚で確認
  await page.goto("/books");
  await expect(page.getByText("1冊")).toBeVisible();
  await page.getByRole("link", { name: /E2Eテストの本/ }).first().click();

  // 読書開始
  await page.getByRole("button", { name: "読み始める" }).click();
  await expect(page.getByRole("button", { name: "進捗更新" })).toBeVisible();

  // 進捗更新
  await page.getByRole("button", { name: "進捗更新" }).click();
  const pageInput = page.getByLabel("現在のページ");
  await pageInput.fill("120");
  await page.getByLabel("メモ（任意）").fill("前半を読んだ");
  await page.getByRole("button", { name: "記録する" }).click();
  await expect(page.getByText("120 / 300ページ")).toBeVisible();
  await expect(page.locator("main").getByText("前半を読んだ")).toBeVisible();

  // フレーズ保存（読書中の本から → 本が自動選択される）
  await page.getByRole("link", { name: "フレーズ保存" }).click();
  await expect(page).toHaveURL(/\/quotes\/new\?bookId=/);
  await expect(page.getByText("『E2Eテストの本』のフレーズとして保存します")).toBeVisible();
  await page.getByRole("button", { name: "テキストを入力" }).click();
  await page.getByLabel("フレーズ").fill("人は、自分が思っているほど自分自身を知らない。");
  await page.getByLabel("ページ").fill("142");
  await page.getByLabel("タグ").fill("人生");
  await page.getByLabel("自分のメモ（なぜ残したのか）").fill("今の自分にも当てはまる");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(/\/quotes\/c[a-z0-9]+$/);
  await expect(page.getByText("人は、自分が思っているほど自分自身を知らない。")).toBeVisible();
  await expect(page.getByText(/p\.142/)).toBeVisible();

  // フレーズ一覧・検索
  await page.goto("/quotes?q=自分自身");
  await expect(page.getByText("1件").first()).toBeVisible();

  // 読了
  await page.goto("/reading");
  await page.getByRole("button", { name: "読了する" }).click();
  await page.getByRole("radio", { name: "5つ星" }).click();
  await page.getByLabel("感想").fill("とても良い本だった");
  await page.getByLabel("学んだこと", { exact: true }).fill("自己理解の大切さ");
  await page.getByRole("button", { name: "読了として保存" }).click();
  await expect(page.getByText("いま読んでいる本はありません")).toBeVisible();

  // 本詳細に読書記録が残る
  await page.goto("/books?status=COMPLETED");
  await page.getByRole("link", { name: /E2Eテストの本/ }).first().click();
  await expect(page.getByText("とても良い本だった")).toBeVisible();
  await expect(page.getByText("保存したフレーズ")).toBeVisible();

  // 統計
  await page.goto("/stats?period=month");
  const tile = page.locator("div", { has: page.getByText("読了冊数", { exact: true }) }).last();
  await expect(tile).toContainText("1");
  await expect(page.getByText("300").first()).toBeVisible();
});

test("ISBN 入力の検証とエラー表示", async ({ page }) => {
  await page.goto("/books/new?mode=search");
  await page.getByLabel("ISBN またはタイトル").fill("978-0000000000");
  await page.getByRole("button", { name: "検索" }).click();
  await expect(page.getByText("ISBNの形式が正しくありません", { exact: false })).toBeVisible();
});

test("フォームのバリデーション（タイトル必須）", async ({ page }) => {
  await page.goto("/books/new?mode=manual");
  await page.getByRole("button", { name: "本棚に追加" }).click();
  await expect(page.getByText("タイトルを入力してください")).toBeVisible();
});

test("フレーズを一覧から削除できる", async ({ page }) => {
  // 削除用のフレーズを作成
  await page.goto("/quotes/new");
  await page.getByRole("button", { name: "テキストを入力" }).click();
  await page.getByLabel("フレーズ").fill("削除テスト用のフレーズ");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(/\/quotes\/c[a-z0-9]+$/);

  await page.goto("/quotes?q=削除テスト用");
  await expect(page.getByText("削除テスト用のフレーズ")).toBeVisible();
  await page.getByRole("button", { name: "フレーズの操作" }).first().click();
  await page.getByRole("menuitem", { name: "削除" }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await expect(page.getByText("フレーズを削除しました")).toBeVisible();
  await expect(page.locator("main").getByText("削除テスト用のフレーズ")).toHaveCount(0);
});

test("フレーズ詳細画面の下部から削除できる", async ({ page }) => {
  await page.goto("/quotes/new");
  await page.getByRole("button", { name: "テキストを入力" }).click();
  await page.getByLabel("フレーズ").fill("詳細から削除するフレーズ");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(/\/quotes\/c[a-z0-9]+$/);
  await page.getByRole("button", { name: "このフレーズを削除" }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await expect(page).toHaveURL(/\/quotes$/);
  await expect(page.getByText("詳細から削除するフレーズ")).toHaveCount(0);
});

test("本棚はリスト表示が標準で、グリッド表示に切り替えられる", async ({ page }) => {
  await page.goto("/books");
  await expect(page.getByRole("button", { name: "グリッド表示に切り替え" })).toBeVisible();
  await page.getByRole("button", { name: "グリッド表示に切り替え" }).click();
  await expect(page).toHaveURL(/view=grid/);
  await expect(page.getByRole("button", { name: "リスト表示に切り替え" })).toBeVisible();
});
