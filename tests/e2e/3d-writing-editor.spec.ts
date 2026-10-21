import { expect, test, type Page } from "@playwright/test";

/** 執筆：作品トップの目次 → 執筆画面（自動保存・記法ボタン・プレビュー・前後のシーン）→ 続きを書く */

async function submitSheet(page: Page, fields: Record<string, string>) {
  const dialog = page.getByRole("dialog");
  for (const [label, value] of Object.entries(fields)) await dialog.getByLabel(label, { exact: true }).fill(value);
  await dialog.getByRole("button", { name: "追加する" }).click();
  await expect(dialog).toHaveCount(0);
}
const toc = (page: Page) => page.getByRole("list", { name: "目次" });
const chapterItem = (page: Page, title: string) => toc(page).locator(":scope > li").filter({ hasText: title });
const saved = (page: Page) => expect(page.getByRole("status", { name: "本文：保存済み" })).toBeVisible();

test("執筆画面：目次からシーンを書き、自動保存して、続きを書く", async ({ page }) => {
  await page.goto("/creative/projects/new");
  await page.getByLabel("作品タイトル *").fill("夜明けの灯台");
  await page.getByRole("button", { name: "作品を作る" }).click();
  await expect(page).toHaveURL(/\/creative\/projects\/c[a-z0-9]+$/);
  const top = page.url();

  // 作品トップに目次。章を作り、章の「＋ シーン」から追加すると執筆画面が開く
  await page.getByRole("button", { name: "章", exact: true }).click();
  await submitSheet(page, { "章タイトル *": "第1章　灯り" });
  await chapterItem(page, "第1章　灯り").getByRole("button", { name: "シーン" }).click();
  await submitSheet(page, { "シーン名 *": "夜の見張り" });
  await expect(page).toHaveURL(/\/write\/c[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: "夜の見張り" })).toBeVisible();

  // 書くと自動で保存され、文字数が出る
  const body = page.getByRole("textbox", { name: "本文" });
  await body.fill("　灯台の灯りが、海を照らしていた。");
  await saved(page);
  await expect(page.getByLabel("文字数")).toContainText("16字");

  // 記法ボタン：選んだ語にルビを振る（カーソルは《》の中）
  await body.evaluate((el: HTMLTextAreaElement) => {
    const i = el.value.indexOf("灯台");
    el.setSelectionRange(i, i + 2);
  });
  await page.getByRole("button", { name: "ルビ" }).click();
  await page.keyboard.type("とうだい");
  await expect(body).toHaveValue("　|灯台《とうだい》の灯りが、海を照らしていた。");
  await saved(page);

  // 『』：選んだ語を囲む。囲んだら元に戻して続ける
  await body.evaluate((el: HTMLTextAreaElement) => {
    const i = el.value.indexOf("海");
    el.setSelectionRange(i, i + 1);
  });
  await page.getByRole("button", { name: "『』" }).click();
  await expect(body).toHaveValue("　|灯台《とうだい》の灯りが、『海』を照らしていた。");
  await body.fill("　|灯台《とうだい》の灯りが、海を照らしていた。");
  await saved(page);

  // 再読み込みしても残っている
  await page.reload();
  await expect(page.getByRole("textbox", { name: "本文" })).toHaveValue("　|灯台《とうだい》の灯りが、海を照らしていた。");

  // AI：カーソル位置なら「続きを書く」、文を選んでいれば「書き直す」。この環境では AI が未設定なので、使えない理由と設定への案内が出る
  await page.getByRole("button", { name: "AI" }).click();
  const panel = page.getByRole("region", { name: "AIで続きを書く" });
  await expect(panel).toContainText("AIは使えません");
  await expect(panel.getByRole("link", { name: "設定" })).toHaveAttribute("href", "/settings");
  await panel.getByRole("button", { name: "AIパネルを閉じる" }).click();
  await expect(panel).toHaveCount(0);
  await page.getByRole("textbox", { name: "本文" }).evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(1, 5));
  await page.getByRole("button", { name: "AI" }).click();
  await expect(page.getByRole("region", { name: "AIで書き直す" })).toContainText("選んだ文を書き直す（4字）");
  await page.getByRole("button", { name: "AIパネルを閉じる" }).click();

  // プレビューではルビになる
  await page.getByRole("button", { name: "プレビュー" }).click();
  await expect(page.getByRole("article", { name: "プレビュー" }).locator("ruby rt")).toHaveText("とうだい");
  await page.getByRole("button", { name: "書く" }).click();

  // 状態を変える
  await page.getByLabel("シーンの状態").selectOption({ label: "初稿" });
  await expect(page.getByLabel("シーンの状態")).toHaveValue("DRAFT");

  // 目次へ戻ると、文字数と状態が反映されている
  await page.getByRole("button", { name: "目次へ戻る" }).click();
  await expect(page).toHaveURL(top);
  await expect(toc(page).getByRole("link", { name: /夜の見張りを書く/ })).toContainText("16字");
  await expect(toc(page).getByRole("link", { name: /夜の見張りを書く/ })).toContainText("初稿");

  // 2つ目のシーン → 前後のシーンへ移動できる
  await chapterItem(page, "第1章　灯り").getByRole("button", { name: "シーン" }).click();
  await submitSheet(page, { "シーン名 *": "嵐の前" });
  await expect(page.getByRole("heading", { name: "嵐の前" })).toBeVisible();
  await page.getByRole("textbox", { name: "本文" }).fill("　風が変わった。");
  await page.getByRole("button", { name: "前のシーン：夜の見張り" }).click();
  await expect(page.getByRole("heading", { name: "夜の見張り" })).toBeVisible();
  await page.getByRole("button", { name: "次のシーン：嵐の前" }).click();
  // 移動する前に保存されている
  await expect(page.getByRole("textbox", { name: "本文" })).toHaveValue("　風が変わった。");

  // 作品トップの「続きを書く」は、最後に書いたシーンを開く
  await page.goto(top);
  await expect(page.getByRole("link", { name: /続きを書く/ })).toContainText("嵐の前");
  await page.getByRole("link", { name: /続きを書く/ }).click();
  await expect(page.getByRole("heading", { name: "嵐の前" })).toBeVisible();
});
