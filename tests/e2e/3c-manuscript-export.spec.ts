import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/** 原稿の書き出し：章・シーンの本文 → 原稿ビュー（横書き・縦書き）→ PDF・Word・テキスト */

async function submitSheet(page: Page, fields: Record<string, string>, advanced = false) {
  const dialog = page.getByRole("dialog");
  if (advanced) await dialog.getByRole("button", { name: "詳細項目も入力する" }).click();
  for (const [label, value] of Object.entries(fields)) await dialog.getByLabel(label, { exact: true }).fill(value);
  await dialog.getByRole("button", { name: "追加する" }).click();
  await expect(dialog).toHaveCount(0);
}

test("原稿の書き出し：本文をまとめて表示し、PDF・Word・テキストで保存できる", async ({ page }) => {
  await page.goto("/creative/projects/new");
  await page.getByLabel("作品タイトル *").fill("港町の手紙");
  await page.getByRole("button", { name: "作品を作る" }).click();
  await expect(page).toHaveURL(/\/creative\/projects\/c[a-z0-9]+$/);
  await page.getByRole("navigation", { name: "作品のメニュー" }).getByRole("link", { name: "📖 章・シーン" }).click();

  // 章がないうちは書き出せない
  await expect(page.getByRole("link", { name: "書き出す" })).toHaveCount(0);
  for (const chapter of ["第1章　手紙", "第2章　返事"]) {
    await page.getByRole("button", { name: "章", exact: true }).click();
    await submitSheet(page, { "章タイトル *": chapter });
  }
  await page.getByRole("link", { name: /第1章.手紙/ }).click();
  await page.getByRole("button", { name: "シーン", exact: true }).click();
  await submitSheet(page, { "シーン名 *": "届いた封筒", "下書き（セリフ・描写など）": "　|郵便受《ゆうびんう》けに、《《一通》》の手紙が入っていた。\n　差出人の名前はない。" }, true);
  // シーンを追加するとシーンの画面に移るので、章へ戻る
  await expect(page.getByRole("heading", { name: /届いた封筒/ })).toBeVisible();
  await page.getByRole("link", { name: /第1章.手紙/ }).click();
  await page.getByRole("button", { name: "シーン", exact: true }).click();
  await submitSheet(page, { "シーン名 *": "まだ書いていない" });
  await expect(page.getByRole("heading", { name: /まだ書いていない/ })).toBeVisible();

  await page.getByRole("navigation", { name: "作品のメニュー" }).getByRole("link", { name: "📖 章・シーン" }).click();
  await page.getByRole("link", { name: "書き出す" }).click();
  await expect(page).toHaveURL(/\/print\/projects\//);

  const paper = page.getByRole("article", { name: "原稿" });
  await expect(paper.getByRole("heading", { name: "港町の手紙" })).toBeVisible();
  await expect(paper.getByRole("heading", { name: "第1章　手紙" })).toBeVisible();
  await expect(paper.getByRole("heading", { name: "届いた封筒" })).toBeVisible();
  // 本文のないシーン・章は入らない
  await expect(paper.getByText("まだ書いていない")).toHaveCount(0);
  await expect(paper.getByText("第2章")).toHaveCount(0);
  // ルビと傍点
  await expect(paper.locator("ruby", { hasText: "郵便受" }).locator("rt")).toHaveText("ゆうびんう");
  await expect(paper.locator("em.ms-emph")).toHaveText("一通");
  await expect(page.getByLabel("原稿の分量")).toContainText("2章・2シーン（本文あり 1）");

  // シーン名を外す・縦書きにする
  await page.getByRole("switch", { name: "シーン名を入れる" }).click();
  await expect(paper.getByRole("heading", { name: "届いた封筒" })).toHaveCount(0);
  await page.getByRole("group", { name: "文字の向き" }).getByRole("link", { name: "縦書き" }).click();
  await expect(page).toHaveURL(/dir=v/);
  await expect(paper).toHaveCSS("writing-mode", "vertical-rl");

  // 印刷（PDF）ではツールバーが消え、原稿だけになる
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "PDFで保存" })).toBeHidden();
  const pdf = await page.pdf({ preferCSSPageSize: true });
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  // 表紙（タイトル）と第1章で、少なくとも2ページ
  expect(pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  await page.emulateMedia({ media: "screen" });

  // テキスト：記法はそのまま、シーン名の代わりに区切りなし（1シーンだけ）
  const [txt] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "テキスト" }).click()]);
  expect(txt.suggestedFilename()).toBe("港町の手紙.txt");
  const text = readFileSync((await txt.path())!, "utf8");
  expect(text).toContain("第1章　手紙\n\n　|郵便受《ゆうびんう》けに、《《一通》》の手紙が入っていた。");

  // Word（Google ドキュメントでも開ける .docx）
  const [docx] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Word・Googleドキュメント" }).click()]);
  expect(docx.suggestedFilename()).toBe("港町の手紙.docx");
  expect(readFileSync((await docx.path())!).subarray(0, 2).toString()).toBe("PK");
});
