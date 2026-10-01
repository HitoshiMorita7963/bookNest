import { expect, test } from "@playwright/test";

const WIDTHS = [375, 390, 414, 430, 768, 1024, 1440];
const PAGES = ["/", "/creative", "/creative/notes", "/creative/projects/new", "/creative/notes/new", "/books", "/books?view=grid", "/reading", "/tsundoku", "/search?q=本", "/quotes", "/knowledge", "/knowledge/map", "/stats", "/calendar", "/goals", "/authors", "/series", "/shelves", "/paths", "/insights", "/life", "/ai", "/settings", "/more", "/books/new"];

test.beforeAll(async ({ browser }) => {
  // サンプルデータを投入（設定画面から）
  const page = await browser.newPage();
  await page.goto("http://localhost:3100/settings");
  const add = page.getByRole("button", { name: "サンプルデータを追加" });
  if (await add.isVisible()) {
    await add.click();
    await expect(page.getByRole("button", { name: "サンプルデータを削除" })).toBeVisible();
  }
  await page.close();
});

for (const width of WIDTHS) {
  test(`横スクロールが発生しない（${width}px）`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const problems: string[] = [];
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 1) problems.push(`${path}: ${overflow}px`);
    }
    expect(problems).toEqual([]);
  });
}

test("スマホでは Bottom Navigation、PC ではサイドバー", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "ボトムナビゲーション" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "メインナビゲーション" })).toBeHidden();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "メインナビゲーション" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "ボトムナビゲーション" })).toBeHidden();
});

test("主要なボタンのタップ領域が 44px 以上", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="ボトムナビゲーション"] a, nav[aria-label="ボトムナビゲーション"] button')].map((el) => {
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    }),
  );
  expect(sizes.length).toBe(5);
  for (const s of sizes) {
    expect(s.w).toBeGreaterThanOrEqual(44);
    expect(s.h).toBeGreaterThanOrEqual(44);
  }
});

test("PWA：マニフェストと Service Worker", async ({ page, request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBeTruthy();
  const manifest = await res.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  await page.goto("/");
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toMatch(/\/$/);
});

test("アップロードの不正ファイルを拒否する", async ({ request }) => {
  const res = await request.post("/api/upload", {
    multipart: { file: { name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<script>alert(1)</script>") }, kind: "cover" },
  });
  expect(res.status()).toBe(400);
  const traversal = await request.get("/api/files/..%2F..%2Fpackage.json");
  expect(traversal.status()).toBe(404);
});

test("本棚の表示（スクリーンショット）", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/books");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "tests/.e2e/books-list.png" });
  await page.goto("/books?view=grid");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "tests/.e2e/books-grid.png" });
  await page.goto("/quotes");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "tests/.e2e/quotes.png" });
});
