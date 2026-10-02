import { expect, test } from "@playwright/test";

test("設定画面から全データを Excel でダウンロードできる", async ({ page }) => {
  await page.goto("/settings");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "すべてのデータ（Excel）" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^booknest-\d{8}-\d{4}\.xlsx$/);
  const res = await page.request.get("/api/export?format=xlsx");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("spreadsheetml");
  // xlsx は zip 形式（先頭が PK）
  expect((await res.body()).subarray(0, 2).toString()).toBe("PK");
});
