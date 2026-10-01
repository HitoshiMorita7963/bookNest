import { test } from "@playwright/test";

// 見た目の確認用（SCREENSHOTS=1 のときだけ実行）。tests/.e2e/shots に保存する
test.skip(!process.env.SCREENSHOTS, "スクリーンショット取得時のみ");

for (const scheme of ["light", "dark"] as const) {
  test(`画面のスクリーンショット（${scheme}）`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 390, height: 844 });
    const shot = async (name: string, path: string) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: `tests/.e2e/shots/${scheme}-${name}.png` });
    };
    await shot("home", "/");
    await shot("creative", "/creative");
    await page.goto("/creative");
    const href = await page.locator('a[href^="/creative/projects/c"]').first().getAttribute("href");
    if (href) {
      await shot("project", href);
      await shot("characters", `${href}/characters`);
      await shot("references", `${href}/references`);
      await shot("timeline", `${href}/timeline`);
      await shot("ai", `${href}/ai`);
      await page.getByRole("button", { name: "関連する読書資料を探して" }).click();
      await page.getByText("参照したBookNestデータ").waitFor();
      await page.screenshot({ path: `tests/.e2e/shots/${scheme}-ai-answer.png`, fullPage: false });
    }
    await shot("notes", "/creative/notes");
    await shot("books", "/books");
  });
}
