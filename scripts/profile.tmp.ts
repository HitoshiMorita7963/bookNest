import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { listQuotes, quoteTags, getQuote } from "../src/server/services/quotes";
import { listBooks, countByStatus, listFacets } from "../src/server/services/books";
import { listKnowledge, knowledgeFacets } from "../src/server/services/knowledge";
import { searchAll } from "../src/server/services/search";
import { listReadingBooks } from "../src/server/services/reading";

const db = new PrismaClient({ adapter: new PrismaLibSQL({ url: process.env.TURSO_DATABASE_URL!.trim(), authToken: process.env.TURSO_AUTH_TOKEN!.trim() }), log: [{ emit: "event", level: "query" }] });
let n = 0;
db.$on("query", () => n++);
async function time(label: string, fn: () => Promise<unknown>) {
  const b = n; const s = performance.now(); await fn();
  console.log(label.padEnd(26), String(Math.round(performance.now() - s)).padStart(5), "ms", String(n - b).padStart(3), "queries");
}
(async () => {
  await db.quote.count();
  const q = await db.quote.findFirst();
  await time("[フレーズ一覧] listQuotes", () => listQuotes(db, { pageSize: 30 }));
  await time("[フレーズ一覧] quoteTags", () => quoteTags(db));
  await time("[フレーズ一覧] 全体", () => Promise.all([listQuotes(db, { pageSize: 30 }), quoteTags(db), db.quote.count()]));
  if (q) await time("[フレーズ詳細] getQuote", () => getQuote(db, q.id));
  await time("[本棚] 全体", () => Promise.all([listBooks(db, { pageSize: 48 }), countByStatus(db), listFacets(db)]));
  await time("[知識] 全体", () => Promise.all([listKnowledge(db, {}), knowledgeFacets(db), db.knowledgeNote.count()]));
  await time("[検索] searchAll", () => searchAll(db, "表情"));
  await time("[読書中] listReadingBooks", () => listReadingBooks(db));
  await db.$disconnect();
})();
