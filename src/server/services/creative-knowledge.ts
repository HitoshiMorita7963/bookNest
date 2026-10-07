/**
 * 創作知識（Creative Knowledge Base）
 * 一般的な創作の知識。読書の具体例（参考にした読書）と自分の創作（CreativeLink.ckId）につながる。
 */
import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { creativeKnowledgeInputSchema, type CreativeKnowledgeInput } from "@/lib/validators";
import { CK_CATEGORIES, CK_CATEGORY_INFO, isCkCategory, CK_RELATION_LABEL, CK_RELATION_REVERSE_LABEL, CK_RELATION_TYPES, type CkCategory, type CkRelationType } from "@/lib/creative-knowledge";
import { cleanupOrphans, upsertTags } from "./books";
import { getSettings, updateSettings } from "./settings";

type Tx = Prisma.TransactionClient | Db;

async function setCategoriesAndTags(tx: Tx, id: string, extraCategories: string[], tagNames: string[]) {
  await tx.creativeKnowledgeCategory.deleteMany({ where: { knowledgeId: id } });
  if (extraCategories.length) await tx.creativeKnowledgeCategory.createMany({ data: extraCategories.map((category) => ({ knowledgeId: id, category })) });
  await tx.creativeKnowledgeTag.deleteMany({ where: { knowledgeId: id } });
  const tagIds = await upsertTags(tx, tagNames);
  if (tagIds.length) await tx.creativeKnowledgeTag.createMany({ data: tagIds.map((tagId) => ({ knowledgeId: id, tagId })) });
}

export async function createCreativeKnowledge(db: Db, input: CreativeKnowledgeInput, opts: { slug?: string; origin?: "seed" | "user" } = {}) {
  const { extraCategories, tags, ...data } = creativeKnowledgeInputSchema.parse(input);
  return db.$transaction(async (tx) => {
    const k = await tx.creativeKnowledge.create({ data: { ...data, slug: opts.slug ?? null, origin: opts.origin ?? "user" } });
    await setCategoriesAndTags(tx, k.id, extraCategories, tags);
    return k;
  });
}

export async function updateCreativeKnowledge(db: Db, id: string, input: CreativeKnowledgeInput, opts: { bySeed?: boolean } = {}) {
  const { extraCategories, tags, ...data } = creativeKnowledgeInputSchema.parse(input);
  return db.$transaction(async (tx) => {
    const cur = await tx.creativeKnowledge.findUnique({ where: { id }, select: { origin: true } });
    if (!cur) throw new NotFoundError("創作知識");
    // サンプルを自分で編集したら、サンプルの更新で上書きしない（サンプルの読み込みによる更新は除く）
    const k = await tx.creativeKnowledge.update({ where: { id }, data: { ...data, userEdited: cur.origin === "seed" && !opts.bySeed ? true : undefined } });
    await setCategoriesAndTags(tx, id, extraCategories, tags);
    await cleanupOrphans(tx);
    return k;
  });
}

export async function deleteCreativeKnowledge(db: Db, id: string) {
  const cur = await db.creativeKnowledge.findUnique({ where: { id }, select: { origin: true, slug: true } });
  await db.$transaction(async (tx) => {
    // CreativeLink.ckId は外部キーなしなので、作品などへの紐付けをここで消す
    await tx.creativeLink.deleteMany({ where: { ckId: id } });
    await tx.creativeKnowledge.delete({ where: { id } });
    await cleanupOrphans(tx);
  });
  // 削除したサンプルは、「基本の創作知識」をもう一度読み込んでも戻さない
  if (cur?.origin === "seed" && cur.slug) {
    const { ckSeedDeleted } = await getSettings(db);
    if (!ckSeedDeleted.includes(cur.slug)) await updateSettings(db, { ckSeedDeleted: [...ckSeedDeleted, cur.slug] });
  }
}

export const ckListInclude = {
  categories: { select: { category: true } },
  tags: { include: { tag: { select: { id: true, name: true } } } },
} satisfies Prisma.CreativeKnowledgeInclude;

export async function getCreativeKnowledge(db: Db, id: string) {
  return db.creativeKnowledge.findUnique({ where: { id }, include: ckListInclude });
}
export type CreativeKnowledgeDetail = NonNullable<Awaited<ReturnType<typeof getCreativeKnowledge>>>;

export interface CkQuery {
  /** 主カテゴリまたは2つ目以降のカテゴリ */
  category?: string;
  /** サブカテゴリ */
  sub?: string;
  tag?: string;
  q?: string;
  favorite?: boolean;
}

export function buildCkWhere(query: CkQuery): Prisma.CreativeKnowledgeWhereInput {
  const and: Prisma.CreativeKnowledgeWhereInput[] = [];
  if (query.category && (CK_CATEGORIES as readonly string[]).includes(query.category)) {
    and.push({ OR: [{ category: query.category }, { categories: { some: { category: query.category } } }] });
  }
  if (query.sub) and.push({ subCategory: query.sub });
  if (query.tag) and.push({ tags: { some: { tag: { name: query.tag } } } });
  if (query.favorite) and.push({ isFavorite: true });
  for (const t of (query.q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 5)) {
    and.push({
      OR: [
        { title: { contains: t } },
        { summary: { contains: t } },
        { definition: { contains: t } },
        { aliases: { contains: t } },
        { subCategory: { contains: t } },
        { tags: { some: { tag: { name: { contains: t } } } } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

export async function listCreativeKnowledge(db: Db, query: CkQuery = {}) {
  return db.creativeKnowledge.findMany({ where: buildCkWhere(query), include: ckListInclude, orderBy: [{ category: "asc" }, { title: "asc" }], take: 500 });
}
export type CkListItem = Awaited<ReturnType<typeof listCreativeKnowledge>>[number];

/** カテゴリごとの件数（2つ目以降のカテゴリも数える） */
export async function ckCategoryCounts(db: Db): Promise<Record<CkCategory, number>> {
  const [primary, extra] = await Promise.all([
    db.creativeKnowledge.groupBy({ by: ["category"], _count: { _all: true } }),
    db.creativeKnowledgeCategory.groupBy({ by: ["category"], _count: { _all: true } }),
  ]);
  const counts = Object.fromEntries(CK_CATEGORIES.map((c) => [c, 0])) as Record<CkCategory, number>;
  for (const r of [...primary, ...extra]) if (r.category in counts) counts[r.category as CkCategory] += r._count._all;
  return counts;
}

/** 創作知識で使われているタグと件数（件数の多い順） */
export async function ckTags(db: Db) {
  const tags = await db.tag.findMany({
    where: { creativeKnowledge: { some: {} } },
    select: { name: true, _count: { select: { creativeKnowledge: true } } },
  });
  return tags.map((t) => ({ name: t.name, count: t._count.creativeKnowledge })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));
}

/** カテゴリ内のサブカテゴリと件数（主カテゴリがそのカテゴリのもの）。並びはカテゴリの候補の順 → それ以外（件数の多い順）→「その他」 */
export async function ckSubCategories(db: Db, category: string) {
  const rows = await db.creativeKnowledge.groupBy({ by: ["subCategory"], where: { category }, _count: { _all: true } });
  const order: string[] = isCkCategory(category) ? CK_CATEGORY_INFO[category].subCategories : [];
  const rank = (name: string) => (name === "その他" ? 2000 : order.includes(name) ? order.indexOf(name) : 1000);
  return rows
    .filter((r) => r.subCategory)
    .map((r) => ({ name: r.subCategory!, count: r._count._all }))
    .sort((a, b) => rank(a.name) - rank(b.name) || b.count - a.count || a.name.localeCompare(b.name, "ja"));
}

/* ---------------- 知識同士の関係 ---------------- */

/** 向きを持たない関係（逆向きの同じ関係があれば、それを使う） */
const SYMMETRIC_TYPES = new Set(["related", "similar", "opposite", "combination"]);

export async function addCkRelation(db: Db, input: { fromId: string; toId: string; type: string; note?: string | null }) {
  const type = (CK_RELATION_TYPES as readonly string[]).includes(input.type) ? input.type : "related";
  if (input.fromId === input.toId) throw new AppError("同じ知識同士はつなげられません", "VALIDATION");
  const found = await db.creativeKnowledge.count({ where: { id: { in: [input.fromId, input.toId] } } });
  if (found !== 2) throw new NotFoundError("創作知識");
  const note = input.note?.trim().slice(0, 100) || null;
  if (SYMMETRIC_TYPES.has(type)) {
    const reverse = await db.creativeKnowledgeRelation.findUnique({ where: { fromId_toId_type: { fromId: input.toId, toId: input.fromId, type } } });
    if (reverse) return note ? db.creativeKnowledgeRelation.update({ where: { id: reverse.id }, data: { note } }) : reverse;
  }
  return db.creativeKnowledgeRelation.upsert({
    where: { fromId_toId_type: { fromId: input.fromId, toId: input.toId, type } },
    create: { fromId: input.fromId, toId: input.toId, type, note },
    update: { note },
  });
}

export async function removeCkRelation(db: Db, id: string) {
  await db.creativeKnowledgeRelation.deleteMany({ where: { id } });
}

export interface CkRelationView {
  id: string;
  /** この知識から見た関係の種類（例：上位の知識） */
  label: string;
  type: CkRelationType;
  note: string | null;
  other: { id: string; title: string; category: string; summary: string };
}

/** 詳細画面用：両方向の関係を、この知識から見た言い方にそろえて返す（種類の順） */
export async function ckRelationsOf(db: Db, id: string): Promise<CkRelationView[]> {
  const select = { id: true, title: true, category: true, summary: true } as const;
  const [from, to] = await Promise.all([
    db.creativeKnowledgeRelation.findMany({ where: { fromId: id }, include: { to: { select } } }),
    db.creativeKnowledgeRelation.findMany({ where: { toId: id }, include: { from: { select } } }),
  ]);
  const asType = (t: string) => ((CK_RELATION_TYPES as readonly string[]).includes(t) ? (t as CkRelationType) : "related");
  const views: CkRelationView[] = [
    ...from.map((r) => ({ id: r.id, type: asType(r.type), label: CK_RELATION_LABEL[asType(r.type)], note: r.note, other: r.to })),
    ...to.map((r) => ({ id: r.id, type: asType(r.type), label: CK_RELATION_REVERSE_LABEL[asType(r.type)], note: r.note, other: r.from })),
  ];
  // 構造（上位・下位・前提）→ 使い方（組み合わせ）→ 比較（似ている・対になる）→ その他の関連 の順
  const order = ["上位の知識", "下位の知識", "前提となる", "これを前提にする", "組み合わせ", "似ている", "対になる", "関連"];
  return views.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label) || a.other.title.localeCompare(b.other.title, "ja"));
}

/* ---------------- お気に入り・自分のメモ ---------------- */

/** お気に入りを切り替えて、新しい状態を返す */
export async function toggleCkFavorite(db: Db, id: string): Promise<boolean> {
  const cur = await db.creativeKnowledge.findUnique({ where: { id }, select: { isFavorite: true } });
  if (!cur) throw new NotFoundError("創作知識");
  const next = !cur.isFavorite;
  await db.creativeKnowledge.update({ where: { id }, data: { isFavorite: next } });
  return next;
}

/**
 * 自分のメモを保存する。一般的な知識（定義・効果など）とは別の列なので、
 * サンプルの知識に自分のメモを書いても「自分で編集した」扱いにはしない（サンプル更新でメモは消えない）。
 */
export async function setCkMyNote(db: Db, id: string, note: string) {
  const text = note.replace(/\r\n/g, "\n").trim();
  if (text.length > 10000) throw new AppError("自分のメモは10000文字以内で入力してください", "VALIDATION");
  const cur = await db.creativeKnowledge.count({ where: { id } });
  if (!cur) throw new NotFoundError("創作知識");
  await db.creativeKnowledge.update({ where: { id }, data: { myNote: text } });
}

/** 関連付けの相手を選ぶための候補（タイトル・別名の部分一致） */
export async function pickCreativeKnowledge(db: Db, q: string, excludeId?: string) {
  const t = q.trim().slice(0, 60);
  return db.creativeKnowledge.findMany({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      ...(t ? { OR: [{ title: { contains: t } }, { aliases: { contains: t } }, { subCategory: { contains: t } }] } : {}),
    },
    select: { id: true, title: true, category: true },
    orderBy: t ? { title: "asc" } : { updatedAt: "desc" },
    take: 30,
  });
}
