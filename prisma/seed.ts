import { PrismaClient } from "@prisma/client";
import { loadSampleData } from "../src/server/services/sample";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({ where: { id: "me" }, create: { id: "me" }, update: {} });
  const r = await loadSampleData(prisma);
  console.log(r.created ? "✅ サンプルデータを作成しました" : "ℹ️ サンプルデータは既に存在します");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
