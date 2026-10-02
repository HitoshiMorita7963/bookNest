import { expect, test, type Page } from "@playwright/test";

/**
 * 読書 → 創作 の流れ（スマートフォン幅）
 * テスト1〜5 は同じ作品を使うため順番に実行する
 */
test.describe.configure({ mode: "serial" });

let projectUrl = "";

const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "作品のメニュー" }).getByRole("link", { name });

async function fillSheetAndSubmit(page: Page, fields: Record<string, string>, submit = "追加する") {
  const dialog = page.getByRole("dialog");
  for (const [label, value] of Object.entries(fields)) await dialog.getByLabel(label, { exact: true }).fill(value);
  await dialog.getByRole("button", { name: submit }).click();
}

test("テスト5：作品 → 人物 → 章 → シーン", async ({ page }) => {
  await page.goto("/creative");
  await expect(page.getByText("まだ小説プロジェクトがありません。")).toBeVisible();
  await page.getByRole("link", { name: "新しい小説", exact: true }).first().click();
  await page.getByLabel("作品タイトル *").fill("灯台の物語");
  await page.getByLabel("一行あらすじ").fill("孤独な灯台守と少女が出会う");
  await page.getByRole("button", { name: "作品を作る" }).click();
  await expect(page).toHaveURL(/\/creative\/projects\/c[a-z0-9]+$/);
  projectUrl = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { name: "✍️ 灯台の物語" })).toBeVisible();

  // 人物
  await tab(page, "👤 人物").click();
  await expect(page.getByText("まだ人物がいません")).toBeVisible();
  await page.getByRole("button", { name: "人物" }).click();
  await fillSheetAndSubmit(page, { "名前 *": "ハル", 役割: "主人公", 目的: "灯台を守り続ける" });
  await expect(page.getByRole("link", { name: /ハル/ })).toBeVisible();

  // 章
  await tab(page, "📖 章・シーン").click();
  await page.getByRole("button", { name: "章" }).click();
  await fillSheetAndSubmit(page, { "章タイトル *": "第3章　再会" });
  await page.getByRole("link", { name: /第3章.再会/ }).click();

  // シーン
  await page.getByRole("button", { name: "シーン" }).click();
  await fillSheetAndSubmit(page, { "シーン名 *": "灯台での再会" });
  await expect(page).toHaveURL(/\/scenes\/c[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: "🎬 灯台での再会" })).toBeVisible();
  await expect(page.getByRole("link", { name: /第3章.再会/ })).toBeVisible();
});

test("テスト1：本 → 創作に使う → 創作メモ作成 → 作品に紐付け", async ({ page }) => {
  await page.goto("/books/new?mode=manual");
  await page.getByLabel("タイトル *").fill("灯台へ（E2E）");
  await page.getByLabel("著者").fill("ヴァージニア・ウルフ");
  await page.getByRole("button", { name: "本棚に追加" }).click();
  await expect(page).toHaveURL(/\/books\/c[a-z0-9]+$/);

  await page.getByRole("button", { name: "創作に使う" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("switch", { name: "作品にも追加する" }).click();
  await expect(dialog.getByLabel("作品", { exact: true })).toHaveValue(/.+/);
  await dialog.getByLabel("タイトル").fill("灯台という孤独のモチーフ");
  await dialog.getByRole("radio", { name: /モチーフ/ }).click();
  await dialog.getByRole("button", { name: "創作メモを作成" }).click();

  // 創作メモの画面：元の本と使っている作品が表示される
  await expect(page).toHaveURL(/\/creative\/notes\/c[a-z0-9]+$/);
  await expect(page.getByText("灯台という孤独のモチーフ").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /『灯台へ（E2E）』/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /『灯台の物語』/ })).toBeVisible();

  // 逆引き：本の画面に「この本から生まれた創作」が表示される
  await page.getByRole("link", { name: /『灯台へ（E2E）』/ }).click();
  await expect(page.getByText("この本から生まれた創作")).toBeVisible();
  await expect(page.getByRole("link", { name: "✍️ 灯台の物語" })).toBeVisible();
});

test("テスト2：フレーズ → 創作に使う → 人物 → キャラクターへ関連付け", async ({ page }) => {
  await page.goto("/quotes/new");
  await page.getByRole("button", { name: "テキストを入力" }).click();
  await page.getByLabel("フレーズ").fill("人は誰でも、自分だけの灯台を胸に持っている。");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(/\/quotes\/c[a-z0-9]+$/);

  await page.getByRole("button", { name: "創作に使う" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: /作品に関連付け/ }).click();
  await dialog.getByRole("radio", { name: "人物" }).click();
  await expect(dialog.getByLabel("人物", { exact: true })).toHaveValue(/.+/);
  await dialog.getByRole("button", { name: "人物造形" }).click();
  await dialog.getByRole("button", { name: "関連付ける" }).click();
  await expect(page.getByText("作品に関連付けました")).toBeVisible();

  // 逆引き：このフレーズを使っている創作
  await expect(page.getByText("このフレーズを使っている創作")).toBeVisible();
  await page.getByRole("link", { name: "ハル" }).click();
  await expect(page).toHaveURL(/\/characters\/c[a-z0-9]+$/);
  await expect(page.getByText(/自分だけの灯台を胸に持っている/)).toBeVisible();
  await expect(page.getByText("用途：人物造形")).toBeVisible();
});

test("テスト3：知識 → 創作に使う → 作品 → シーンへ関連付け", async ({ page }) => {
  await page.goto("/knowledge/new");
  await page.getByLabel("タイトル（得た知識・考え方）").fill("フレネルレンズの仕組み");
  await page.getByLabel("内容").fill("灯台の光を遠くまで届けるための段状のレンズ");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(/\/knowledge\/c[a-z0-9]+$/);

  await page.getByRole("button", { name: "創作に使う" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: /作品に関連付け/ }).click();
  await dialog.getByRole("radio", { name: "シーン" }).click();
  await expect(dialog.getByLabel("シーン", { exact: true })).toHaveValue(/.+/);
  await dialog.getByRole("button", { name: "関連付ける" }).click();
  await expect(page.getByText("作品に関連付けました")).toBeVisible();
  await expect(page.getByText("この知識を使っている創作")).toBeVisible();

  await page.getByRole("link", { name: "灯台での再会" }).click();
  await expect(page.getByText("フレネルレンズの仕組み")).toBeVisible();
});

test("テスト4：作品 → AI編集者 → 関連する読書資料を探す → 参照元表示", async ({ page }) => {
  await page.goto(projectUrl);
  // この作品に影響を与えたもの
  await expect(page.getByText("この作品に影響を与えたもの")).toBeVisible();
  await tab(page, "🤖 AI編集者").click();
  await expect(page.getByText("何について相談しますか？")).toBeVisible();
  await page.getByRole("button", { name: "関連する読書資料を探して" }).click();
  await expect(page.getByText("参照したBookNestデータ")).toBeVisible({ timeout: 30_000 });
  const refs = page.locator("div", { has: page.getByText("参照したBookNestデータ") }).last();
  await expect(refs.getByRole("link", { name: /📚 『灯台へ（E2E）』/ })).toBeVisible();
  await expect(refs.getByRole("link", { name: /💬 “人は誰でも/ })).toBeVisible();
  await expect(refs.getByRole("link", { name: /🧠 フレネルレンズの仕組み/ })).toBeVisible();
  // 参照元をタップすると元データへ移動できる
  await refs.getByRole("link", { name: /🧠 フレネルレンズの仕組み/ }).click();
  await expect(page).toHaveURL(/\/knowledge\/c[a-z0-9]+$/);
});

test("創作メモのクイック保存（＋メニューから）と空状態", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "追加メニューを開く" }).click();
  await page.getByRole("link", { name: /創作メモ/ }).click();
  await page.getByLabel("本文").fill("雨の日だけ開く古書店\n店主は記憶を売っている");
  await page.getByRole("radio", { name: /設定/ }).click();
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(/\/creative\/notes\/c[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: "雨の日だけ開く古書店" })).toBeVisible();
  // 作品タイムライン
  await page.goto(`${projectUrl}/timeline`);
  await expect(page.getByText(/人物「ハル」を作成/)).toBeVisible();
  await expect(page.getByText(/フレーズ保存/)).toBeVisible();
});
