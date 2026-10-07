/**
 * 創作知識の初期データ（サンプル）の読み込み。
 * - slug で同じ知識を見分けるので、何度読み込んでも重複しない
 * - まだない知識は追加、内容が変わったサンプルは更新する
 * - 自分で編集したサンプル（userEdited）は上書きしない。お気に入り・自分のメモ・参考にした読書・作品への紐付けは常に残る
 */
import type { Db } from "@/lib/db";
import type { CreativeKnowledgeInput } from "@/lib/validators";
import { CK_SEEDS, type CkSeed } from "@/server/data/creative-knowledge-seed";
import { createCreativeKnowledge, updateCreativeKnowledge } from "./creative-knowledge";

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

/** 1回の呼び出しで追加・更新する件数（本番の処理時間の上限に収めるため、画面から続けて呼ぶ） */
export const CK_SEED_BATCH = 40;

/**
 * サンプルを読み込む（追加・更新）。1回に limit 件まで処理し、残りの件数を返す。
 * すべて読み込み終わった回に、知識同士の関係をまとめてつなげる（両方の知識があるときだけ）。
 */
export async function syncCkSeeds(db: Db, opts: { limit?: number } = {}) {
  const limit = opts.limit ?? Infinity;
  const existing = new Map((await loadExisting(db)).map((k) => [k.slug!, k]));
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let remaining = 0;
  for (const s of CK_SEEDS) {
    const k = existing.get(s.slug);
    if (k?.userEdited) {
      skipped++;
      continue;
    }
    if (k && isSame(k, s)) continue;
    if (created + updated >= limit) {
      remaining++;
      continue;
    }
    if (!k) {
      await createCreativeKnowledge(db, toInput(s), { slug: s.slug, origin: "seed" });
      created++;
    } else {
      await updateCreativeKnowledge(db, k.id, toInput(s), { bySeed: true });
      updated++;
    }
  }
  const linked = remaining === 0 ? await linkSeedRelations(db) : 0;
  return { created, updated, skipped, remaining, linked };
}

/** サンプル同士の関係で、まだないものをまとめて作る（逆向きの同じ種類の関係や、自分で付けた関係はそのまま） */
async function linkSeedRelations(db: Db) {
  const rows = await db.creativeKnowledge.findMany({ where: { slug: { in: CK_SEEDS.map((s) => s.slug) } }, select: { id: true, slug: true } });
  const idBySlug = new Map(rows.map((r) => [r.slug!, r.id]));
  const ids = [...idBySlug.values()];
  const current = await db.creativeKnowledgeRelation.findMany({ where: { fromId: { in: ids }, toId: { in: ids } }, select: { fromId: true, toId: true, type: true } });
  const has = new Set(current.flatMap((r) => [`${r.fromId}|${r.toId}|${r.type}`, `${r.toId}|${r.fromId}|${r.type}`]));
  const data: { fromId: string; toId: string; type: string }[] = [];
  for (const s of CK_SEEDS) {
    for (const [type, to] of s.relations ?? []) {
      const fromId = idBySlug.get(s.slug);
      const toId = idBySlug.get(to);
      if (!fromId || !toId || fromId === toId || has.has(`${fromId}|${toId}|${type}`)) continue;
      has.add(`${fromId}|${toId}|${type}`).add(`${toId}|${fromId}|${type}`);
      data.push({ fromId, toId, type });
    }
  }
  if (data.length) await db.creativeKnowledgeRelation.createMany({ data });
  return data.length;
}
