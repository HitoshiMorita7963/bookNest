/** シリーズ・巻の自動判定の確認（--ai で AI 版も試す。DB は変更しない） */
import { bookMetadataService } from "../src/server/services/metadata";
import { deriveSeries } from "../src/lib/series";
import { classifyByRules } from "../src/lib/classify";

async function main() {
  const isbns = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  for (const isbn of isbns) {
    const m = await bookMetadataService.lookupIsbn(isbn);
    if (!m) {
      console.log(isbn, "not found");
      continue;
    }
    const s = deriveSeries(m);
    console.log(`${m.title} [volume ${m.volume ?? "-"} / series ${m.seriesTitle ?? "-"}] → ${s.seriesTitle ?? "なし"} ${s.seriesNumber ?? ""}`);
    if (process.argv.includes("--ai")) {
      const { suggestGenreTags } = await import("../src/server/ai/features");
      const ai = await suggestGenreTags(m, classifyByRules(m));
      console.log(`    AI → ${ai.seriesTitle || "なし"} ${ai.seriesNumber ?? ""}`);
    }
  }
}
main();
