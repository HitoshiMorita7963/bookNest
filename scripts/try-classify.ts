/** ジャンル・タグ自動提案の確認（--ai で AI 版も試す。DB は変更しない） */
import { bookMetadataService } from "../src/server/services/metadata";
import { classifyByRules } from "../src/lib/classify";

async function main() {
  const isbns = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  for (const isbn of isbns.length ? isbns : ["9784101010014", "9784004319153", "9784478025819", "9784062748681"]) {
    const m = await bookMetadataService.lookupIsbn(isbn);
    if (!m) {
      console.log(isbn, "not found");
      continue;
    }
    const draft = classifyByRules(m);
    console.log(`${m.title} [NDC ${m.ndc ?? "-"}] rules → ${draft.genre} / ${draft.tags.join("、")}`);
    if (process.argv.includes("--ai")) {
      const { suggestGenreTags } = await import("../src/server/ai/features");
      const ai = await suggestGenreTags(m, draft);
      console.log(`    AI → ${ai.genre} / ${ai.tags.join("、")}`);
    }
  }
}
main();
