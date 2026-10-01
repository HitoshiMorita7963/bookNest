/** 設定済み API キーの動作確認（キーの値は表示しない） */
import sharp from "sharp";
import { googleBooksProvider, bookMetadataService } from "../src/server/services/metadata";

async function main() {
  // Google Books（キー付き）
  const g = await googleBooksProvider.lookupIsbn("9784101010014").catch((e) => `ERR ${(e as Error).message}`);
  console.log("[Google Books] isbn:", typeof g === "string" ? g : g ? `${g.title} / ${g.authors.join("、")} / ${g.pageCount ?? "-"}p / cover:${!!g.coverImage}` : "見つからず");
  const s = await googleBooksProvider.search!("銀河鉄道の夜").catch(() => []);
  console.log("[Google Books] title search:", s.length, "件", s.slice(0, 3).map((x) => x.title).join(" | "));
  const merged = await bookMetadataService.lookupIsbn("9784101010014");
  console.log("[統合] cover:", merged?.coverImage ? "あり" : "なし", "pages:", merged?.pageCount, "desc:", merged?.description ? "あり" : "なし");

  // Google Cloud Vision（OCR_API_KEY）
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="200"><rect width="100%" height="100%" fill="#f6f1e7"/><text x="30" y="80" font-family="Yu Mincho, serif" font-size="44">人は、自分が思っているほど</text><text x="30" y="150" font-family="Yu Mincho, serif" font-size="44">自分自身を知らない。</text></svg>`;
  const content = (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(process.env.OCR_API_KEY ?? "")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ image: { content }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }], imageContext: { languageHints: ["ja"] } }] }),
  });
  const json = (await res.json()) as { responses?: { fullTextAnnotation?: { text?: string } }[]; error?: { status?: string; message?: string } };
  console.log("[Vision] HTTP", res.status, json.error ? `${json.error.status}: ${json.error.message?.slice(0, 160)}` : JSON.stringify(json.responses?.[0]?.fullTextAnnotation?.text));
}
main();
