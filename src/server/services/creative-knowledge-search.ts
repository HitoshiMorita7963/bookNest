/**
 * 創作知識の検索。
 * タイトルが完全に一致しなくても見つかるよう、項目ごとに重みをつけて採点する。
 *  - 部分一致（タイトル・別名・タグ・カテゴリ・概要・定義・効果・パターン・使い方・参考読書のコメント）
 *  - 文字の 2-gram の重なり（日本語の言い換え・語順の違いに強い）
 *  - 上位の知識とつながっている知識を「関連」として加える
 * 将来 Embedding によるベクトル検索に置き換える場合も、この関数の戻り値の形を保てば画面と AI 側は変えずに済む。
 */
import type { Db } from "@/lib/db";
import { CK_CATEGORY_INFO, ckCategoryLabel, isCkCategory, lines } from "@/lib/creative-knowledge";
import { bigrams } from "./creative";
import { ckListInclude, type CkListItem } from "./creative-knowledge";

export interface CkSearchHit {
  item: CkListItem;
  score: number;
  /** なぜ見つかったか（画面に表示する短い説明） */
  reason: string;
  /** 関連知識として加わった場合、元になった知識のタイトル */
  via?: string;
}

const norm = (s: string) => s.normalize("NFKC").toLowerCase().trim();

/** a と b の 2-gram の重なり（b の長さに対する割合。短いクエリでも効くよう、小さい方を分母にする） */
function overlap(query: Set<string>, text: string): number {
  if (query.size === 0 || !text) return 0;
  const g = bigrams(text);
  if (!g.size) return 0;
  let inter = 0;
  for (const x of query) if (g.has(x)) inter++;
  return inter / Math.min(query.size, g.size);
}

export async function searchCreativeKnowledge(
  db: Db,
  q: string,
  opts: { category?: string; tag?: string; take?: number; withRelated?: boolean } = {},
): Promise<CkSearchHit[]> {
  const query = norm(q).slice(0, 100);
  if (!query) return [];
  const terms = query.split(/\s+/).filter(Boolean).slice(0, 5);
  const qGrams = bigrams(query);

  const items = await db.creativeKnowledge.findMany({
    include: {
      ...ckListInclude,
      relationsFrom: { select: { toId: true } },
      relationsTo: { select: { fromId: true } },
      references: { select: { comment: true, workTitle: true, location: true } },
    },
    take: 3000,
  });

  const scored = new Map<string, { score: number; reason: string }>();
  for (const k of items) {
    const title = norm(k.title);
    const aliases = lines(k.aliases).map(norm);
    const tags = k.tags.map((t) => norm(t.tag.name));
    const cats = [k.category, ...k.categories.map((c) => c.category)].map((c) => norm(ckCategoryLabel(c)));
    const sub = norm(k.subCategory ?? "");
    const body = norm([k.summary, k.definition, k.effects, k.patterns, k.flow, k.usage, k.cautions].join("\n"));
    const refs = norm(k.references.map((r) => [r.comment, r.workTitle, r.location].filter(Boolean).join(" ")).join("\n"));

    let score = 0;
    let reason = "";
    const note = (s: number, r: string) => {
      score += s;
      if (!reason && s > 0) reason = r;
    };

    // 文全体での一致
    if (title === query) note(30, "タイトルが一致");
    else if (title.includes(query) || (query.length >= 2 && query.includes(title))) note(16, "タイトルに一致");
    const alias = aliases.find((a) => a === query || a.includes(query) || (query.length >= 3 && query.includes(a)));
    if (alias) note(14, `別名「${alias}」に一致`);
    if (tags.some((t) => t === query)) note(10, `タグ #${query}`);
    if (cats.some((c) => c === query) || sub === query) note(8, "カテゴリに一致");

    // 単語ごとの一致
    for (const t of terms) {
      if (title.includes(t)) note(5, "タイトルに一致");
      if (aliases.some((a) => a.includes(t))) note(4, "別名に一致");
      if (tags.some((tag) => tag.includes(t))) note(4, "タグに一致");
      if (sub.includes(t) || cats.some((c) => c.includes(t))) note(3, "カテゴリに一致");
      if (body.includes(t)) note(2, "説明に一致");
      if (refs.includes(t)) note(1.5, "参考読書のメモに一致");
    }

    // 言い換え・語順の違い（2-gram の重なり）
    const titleSim = Math.max(overlap(qGrams, title), ...aliases.map((a) => overlap(qGrams, a)));
    if (titleSim >= 0.34) note(titleSim * 10, "タイトル・別名が近い");
    const bodySim = overlap(qGrams, body);
    if (bodySim >= 0.34) note(bodySim * 5, "説明の内容が近い");

    if (score >= 3) scored.set(k.id, { score, reason });
  }

  const byId = new Map(items.map((k) => [k.id, k]));
  const hits: CkSearchHit[] = [...scored.entries()].map(([id, s]) => ({ item: byId.get(id)!, score: s.score, reason: s.reason }));
  hits.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, "ja"));

  // 上位の知識につながる知識を「関連」として加える
  if (opts.withRelated !== false) {
    for (const top of hits.slice(0, 5)) {
      const k = byId.get(top.item.id)!;
      const neighborIds = [...k.relationsFrom.map((r) => r.toId), ...k.relationsTo.map((r) => r.fromId)];
      for (const nid of neighborIds) {
        if (scored.has(nid) || !byId.has(nid)) continue;
        scored.set(nid, { score: top.score * 0.4, reason: "" });
        hits.push({ item: byId.get(nid)!, score: top.score * 0.4, reason: `「${k.title}」の関連知識`, via: k.title });
      }
    }
    hits.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, "ja"));
  }

  const filtered = hits.filter(
    (h) =>
      (!opts.category || !isCkCategory(opts.category) || h.item.category === opts.category || h.item.categories.some((c) => c.category === opts.category)) &&
      (!opts.tag || h.item.tags.some((t) => t.tag.name === opts.tag)),
  );
  return filtered.slice(0, opts.take ?? 50);
}

/** 画面用：カテゴリ名を含む説明（例：「トロープ・定番 ・ 別名に一致」） */
export function hitLabel(h: CkSearchHit) {
  const cat = isCkCategory(h.item.category) ? CK_CATEGORY_INFO[h.item.category].label : h.item.category;
  return `${cat} ・ ${h.reason}`;
}
