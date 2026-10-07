/**
 * 創作知識の初期データ（サンプル）の読み込み。
 * - slug で同じ知識を見分けるので、何度読み込んでも重複しない
 * - まだない知識は追加、内容が変わったサンプルは更新する
 * - 自分で編集したサンプル（userEdited）は上書きしない。お気に入り・自分のメモ・参考にした読書・作品への紐付けは常に残る
 */
import type { Db } from "@/lib/db";
import type { CreativeKnowledgeInput } from "@/lib/validators";
import { CK_SEEDS, type CkSeed } from "@/server/data/creative-knowledge-seed";
import { addCkRelation, createCreativeKnowledge, updateCreativeKnowledge } from "./creative-knowledge";

function toInput(s: CkSeed): CreativeKnowledgeInput {
  const join = (xs?: string[]) => (xs ?? []).join("\n");
  return {
    title: s.title,
    category: s.category,
    extraCategories: s.extraCategories ?? [],
    subCategory: s.subCategory ?? "",
    summary: s.summary,
    definition: s.definition ?? "",
    effects: join(s.effects),
    patterns: join(s.patterns),
    flow: join(s.flow),
    usage: join(s.usage),
    cautions: join(s.cautions),
    aliases: join(s.aliases),
    tags: s.tags ?? [],
  };
}

const FIELDS = ["title", "category", "subCategory", "summary", "definition", "effects", "patterns", "flow", "usage", "cautions", "aliases"] as const;

type Existing = Awaited<ReturnType<typeof loadExisting>>[number];
async function loadExisting(db: Db) {
  return db.creativeKnowledge.findMany({
    where: { slug: { in: CK_SEEDS.map((s) => s.slug) } },
    include: { categories: { select: { category: true } }, tags: { include: { tag: { select: { name: true } } } } },
  });
}

/** サンプルの内容と、DB の内容が同じか */
function isSame(k: Existing, s: CkSeed) {
  const input = toInput(s);
  const sameFields = FIELDS.every((f) => (k[f] ?? "") === (input[f] ?? ""));
  const sameList = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join("\n") === [...b].sort().join("\n");
  return sameFields && sameList(k.categories.map((c) => c.category), (s.extraCategories ?? []).filter((c) => c !== s.category)) && sameList(k.tags.map((t) => t.tag.name), s.tags ?? []);
}

export interface CkSeedStatus {
  total: number;
  /** まだ読み込んでいない */
  missing: number;
  /** サンプルの内容が新しくなっている（自分で編集していないもの） */
  outdated: number;
  /** 自分で編集したので更新しないもの */
  edited: number;
}

export async function ckSeedStatus(db: Db): Promise<CkSeedStatus> {
  const existing = new Map((await loadExisting(db)).map((k) => [k.slug!, k]));
  let missing = 0;
  let outdated = 0;
  let edited = 0;
  for (const s of CK_SEEDS) {
    const k = existing.get(s.slug);
    if (!k) missing++;
    else if (k.userEdited) edited++;
    else if (!isSame(k, s)) outdated++;
  }
  return { total: CK_SEEDS.length, missing, outdated, edited };
}

/** サンプルを読み込む（追加・更新）。関係は、両方の知識があるときだけつなげる */
export async function syncCkSeeds(db: Db) {
  const existing = new Map((await loadExisting(db)).map((k) => [k.slug!, k]));
  const idBySlug = new Map<string, string>();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const s of CK_SEEDS) {
    const k = existing.get(s.slug);
    if (!k) {
      idBySlug.set(s.slug, (await createCreativeKnowledge(db, toInput(s), { slug: s.slug, origin: "seed" })).id);
      created++;
      continue;
    }
    idBySlug.set(s.slug, k.id);
    if (k.userEdited) skipped++;
    else if (!isSame(k, s)) {
      await updateCreativeKnowledge(db, k.id, toInput(s), { bySeed: true });
      updated++;
    }
  }
  for (const s of CK_SEEDS) {
    for (const [type, to] of s.relations ?? []) {
      const fromId = idBySlug.get(s.slug);
      const toId = idBySlug.get(to);
      if (!fromId || !toId) continue;
      // 既にある関係（逆向き・自分で書いたメモを含む）は addCkRelation 側でそのまま残る
      const exists = await db.creativeKnowledgeRelation.count({ where: { OR: [{ fromId, toId, type }, { fromId: toId, toId: fromId, type }] } });
      if (!exists) await addCkRelation(db, { fromId, toId, type });
    }
  }
  return { created, updated, skipped };
}
