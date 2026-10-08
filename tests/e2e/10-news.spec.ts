import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// E2E では外部のニュースを取りに行かない（NEWS_DISABLED）ので、テスト用のニュースを DB に直接入れる
const db = new PrismaClient({ datasourceUrl: "file:../tests/.e2e/e2e.db" });
const jstDay = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

test.afterAll(async () => {
  await db.$disconnect();
});

test("最新のニュース：保存して知識につなげる → 保存したニュース・知識の関連ニュースに表示", async ({ page }) => {
  test.skip(process.env.E2E_MODE === "cloud", "ローカル DB に直接書き込むテスト");
  const knowledge = await db.knowledgeNote.create({ data: { title: "E2Eデータセンター", content: "" } });
  await db.newsItem.create({
    data: { title: "E2Eデータセンター誘致で地方に投資", url: `https://example.com/e2e-news-${Date.now()}`, source: "E2E新聞", feed: "knowledge", day: jstDay(), keyword: "E2Eデータセンター", publishedAt: new Date(), fetchedAt: new Date() },
  });

  await page.goto("/");
  const section = page.locator("section", { has: page.getByRole("heading", { name: /📰 最新のニュース/ }) });
  await expect(section.getByText("E2Eデータセンター誘致で地方に投資")).toBeVisible();
  // 集めた時刻と更新ボタン（E2E では外部に取りに行かないので「取得できませんでした」になり、一覧はそのまま）
  await expect(section.getByText(/\d+:\d{2} 時点/)).toBeVisible();
  await section.getByRole("button", { name: "ニュースを更新" }).click();
  await expect(page.getByText("ニュースを取得できませんでした。しばらくしてからお試しください")).toBeVisible();
  await expect(section.getByText("E2Eデータセンター誘致で地方に投資")).toBeVisible();
  // 見出しから見つけた候補の知識
  await expect(section.getByText("🧠 E2Eデータセンター？")).toBeVisible();

  await page.getByRole("button", { name: "保存して知識につなげる：E2Eデータセンター誘致で地方に投資" }).click();
  const sheet = page.getByRole("dialog");
  // 候補は最初から選ばれている
  await expect(sheet.getByRole("button", { name: /E2Eデータセンター/ }).first()).toHaveAttribute("aria-pressed", "true");
  await sheet.getByLabel("メモ（任意）").fill("電力の確保が鍵");
  await sheet.getByRole("button", { name: "保存して1件の知識につなげる" }).click();
  await expect(page.getByText("保存して、知識1件につなげました")).toBeVisible();
  await expect(section.getByRole("link", { name: "🧠 E2Eデータセンター" })).toBeVisible();

  // 保存したニュース
  await page.goto("/news");
  await expect(page.getByRole("region", { name: "保存したニュース" }).getByText("E2Eデータセンター誘致で地方に投資")).toBeVisible();
  await expect(page.getByRole("region", { name: "保存したニュース" }).getByText("📝 電力の確保が鍵")).toBeVisible();

  // 知識の画面の関連ニュース
  await page.goto(`/knowledge/${knowledge.id}`);
  await expect(page.getByRole("region", { name: "関連ニュース" }).getByText("E2Eデータセンター誘致で地方に投資")).toBeVisible();
});
