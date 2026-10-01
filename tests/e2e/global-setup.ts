import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

/** E2E 用の空のデータベースを用意する（本番ビルドは `npm run test:e2e` の前に `npm run build` で作成） */
export default function globalSetup() {
  const dir = path.join(process.cwd(), "tests", ".e2e");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: "file:../tests/.e2e/e2e.db" },
    stdio: "pipe",
  });
}
