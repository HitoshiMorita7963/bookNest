/** 楽天ブックス・OpenAI の接続確認（値は表示しない） */
import { rakutenProvider, bookMetadataService } from "../src/server/services/metadata";

async function main() {
  for (const isbn of ["9784101010014", "9784167158057", "9784065136409"]) {
    const r = await rakutenProvider.lookupIsbn(isbn).catch((e) => `error: ${e.message}`);
    console.log("rakuten", isbn, typeof r === "string" ? r : r ? `${r.title} / cover=${r.coverImage ? "yes" : "no"}` : "null");
    console.log("cover  ", isbn, await bookMetadataService.findCover(isbn, typeof r === "object" && r ? r.title : null));
  }
  if (process.argv.includes("--ai")) {
    const { getProvider } = await import("../src/server/ai/provider");
    const p = getProvider();
    const text = await p.chat({
      system: "日本語で簡潔に答えてください。",
      messages: [{ role: "user", content: "本棚にある本の冊数をツールで調べて答えて" }],
      tools: [{ name: "count_books", description: "本棚の冊数を返す", input_schema: { type: "object", properties: {} } }],
      runTool: async () => JSON.stringify({ count: 42 }),
    });
    console.log("ai chat:", text);
    const j = await p.json<{ tags: string[] }>({ system: "タグを付けて", prompt: "人は誰でも孤独な灯台だ", schema: { type: "object", properties: { tags: { type: "array", items: { type: "string" } } }, required: ["tags"], additionalProperties: false } });
    console.log("ai json:", j);
  }
}
main().catch((e) => {
  console.error("FAILED:", e?.constructor?.name, e?.status ?? "", e?.message?.slice(0, 300));
  process.exit(1);
});
