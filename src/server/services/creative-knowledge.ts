/**
 * 創作知識（Creative Knowledge Base）
 * 一般的な創作の知識。読書の具体例（参考にした読書）と自分の創作（CreativeLink.ckId）につながる。
 */
import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { creativeKnowledgeInputSchema, type CreativeKnowledgeInput } from "@/lib/validators";
import { CK_CATEGORIES, type CkCategory } from "@/lib/creative-knowledge";
import { cleanupOrphans, upsertTags } from "./books";

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

export async function updateCreativeKnowledge(db: Db, id: string, input: CreativeKnowledgeInput) {
  const { extraCategories, tags, ...data } = creativeKnowledgeInputSchema.parse(input);
  return db.$transaction(async (tx) => {
    const cur = await tx.creativeKnowledge.findUnique({ where: { id }, select: { origin: true } });
    if (!cur) throw new NotFoundError("創作知識");
    // サンプルを自分で編集したら、サンプルの更新で上書きしない
    const k = await tx.creativeKnowledge.update({ where: { id }, data: { ...data, userEdited: cur.origin === "seed" ? true : undefined } });
    await setCategoriesAndTags(tx, id, extraCategories, tags);
    await cleanupOrphans(tx);
    return k;
  });
}

export async function deleteCreativeKnowledge(db: Db, id: string) {
  await db.$transaction(async (tx) => {
    // CreativeLink.ckId は外部キーなしなので、作品などへの紐付けをここで消す
    await tx.creativeLink.deleteMany({ where: { ckId: id } });
    await tx.creativeKnowledge.delete({ where: { id } });
    await cleanupOrphans(tx);
  });
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
  tag?: string;
  q?: string;
  favorite?: boolean;
}

export function buildCkWhere(query: CkQuery): Prisma.CreativeKnowledgeWhereInput {
  const and: Prisma.CreativeKnowledgeWhereInput[] = [];
  if (query.category && (CK_CATEGORIES as readonly string[]).includes(query.category)) {
    and.push({ OR: [{ category: query.category }, { categories: { some: { category: query.category } } }] });
  }
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
