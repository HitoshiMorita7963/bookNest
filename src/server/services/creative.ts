/**
 * 創作メモと「読書 → 創作」の紐付け（CreativeLink）
 */
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import type { Db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { creativeNoteInputSchema, linkInputSchema, type CreativeNoteInput, type LinkInput } from "@/lib/validators";
import { CREATIVE_CATEGORY_LABEL, LINK_TARGET_LABEL, NOTE_STATUSES, type CreativeCategory, type LinkSourceKind, type LinkTargetKind } from "@/lib/constants";
import { cleanupOrphans, upsertTags } from "./books";
import { quoted } from "@/lib/quote-marks";

type Tx = Prisma.TransactionClient | Db;

/* ---------------- 創作メモ ---------------- */

export async function createCreativeNote(db: Db, input: CreativeNoteInput, opts: { isSample?: boolean } = {}) {
  const data = creativeNoteInputSchema.parse(input);
  return db.$transaction(async (tx) => {
    const tagIds = await upsertTags(tx, data.tags);
    return tx.creativeNote.create({
      data: {
        title: data.title,
        content: data.content,
        category: data.category,
        status: data.status,
        isSample: opts.isSample ?? false,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
  });
}

export async function updateCreativeNote(db: Db, id: string, input: CreativeNoteInput) {
  const data = creativeNoteInputSchema.parse(input);
  const cur = await db.creativeNote.findUnique({ where: { id }, select: { id: true } });
  if (!cur) throw new NotFoundError("創作メモ");
  return db.$transaction(async (tx) => {
    const tagIds = await upsertTags(tx, data.tags);
    await tx.creativeNoteTag.deleteMany({ where: { noteId: id } });
    const n = await tx.creativeNote.update({
      where: { id },
      data: { title: data.title, content: data.content, category: data.category, status: data.status, tags: { create: tagIds.map((tagId) => ({ tagId })) } },
    });
    await cleanupOrphans(tx);
    return n;
  });
}

export async function setCreativeNoteStatus(db: Db, id: string, status: string) {
  const s = z.enum(NOTE_STATUSES).parse(status);
  return db.creativeNote.update({ where: { id }, data: { status: s } });
}

export async function deleteCreativeNote(db: Db, id: string) {
  await db.$transaction(async (tx) => {
    await tx.creativeNote.delete({ where: { id } });
    await cleanupOrphans(tx);
  });
}

export interface CreativeNoteQuery {
  q?: string;
  category?: string;
  status?: string;
  projectId?: string;
  take?: number;
}

export function buildNoteWhere(query: CreativeNoteQuery): Prisma.CreativeNoteWhereInput {
  const and: Prisma.CreativeNoteWhereInput[] = [];
  for (const t of (query.q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 5)) {
    and.push({ OR: [{ title: { contains: t } }, { content: { contains: t } }, { tags: { some: { tag: { name: { contains: t } } } } }] });
  }
  if (query.category) and.push({ category: query.category });
  if (query.status) and.push({ status: query.status });
  else and.push({ status: { not: "ARCHIVED" } });
  if (query.projectId) and.push({ usedIn: { some: { projectId: query.projectId } } });
  return and.length ? { AND: and } : {};
}

export const noteListInclude = {
  tags: { include: { tag: true } },
  usedIn: { select: { project: { select: { id: true, title: true } } }, take: 5 },
  _count: { select: { materials: true, usedIn: true } },
} satisfies Prisma.CreativeNoteInclude;

export async function listCreativeNotes(db: Db, query: CreativeNoteQuery = {}) {
  const where = buildNoteWhere(query);
  const [items, total] = await Promise.all([
    db.creativeNote.findMany({ where, include: noteListInclude, orderBy: { updatedAt: "desc" }, take: query.take ?? 100 }),
    db.creativeNote.count({ where }),
  ]);
  return { items, total };
}

export async function getCreativeNote(db: Db, id: string) {
  return db.creativeNote.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      materials: { include: linkSourceInclude, orderBy: { createdAt: "desc" } },
      usedIn: { include: linkTargetInclude, orderBy: { createdAt: "desc" } },
    },
  });
}

/* ---------------- 紐付け（CreativeLink） ---------------- */

export const linkSourceInclude = {
  book: { select: { id: true, title: true, coverImage: true } },
  quote: { select: { id: true, text: true, pageNumber: true, book: { select: { id: true, title: true } } } },
  knowledge: { select: { id: true, title: true } },
  note: { select: { id: true, title: true, category: true } },
} satisfies Prisma.CreativeLinkInclude;

export const linkTargetInclude = {
  project: { select: { id: true, title: true } },
  character: { select: { id: true, name: true, projectId: true } },
  world: { select: { id: true, title: true, projectId: true } },
  plot: { select: { id: true, title: true, projectId: true } },
  chapter: { select: { id: true, title: true, projectId: true } },
  scene: { select: { id: true, title: true, chapterId: true, chapter: { select: { projectId: true, title: true } } } },
  targetNote: { select: { id: true, title: true, category: true } },
} satisfies Prisma.CreativeLinkInclude;

const SOURCE_COLUMN: Record<LinkSourceKind, "bookId" | "quoteId" | "knowledgeId" | "noteId"> = {
  book: "bookId",
  quote: "quoteId",
  knowledge: "knowledgeId",
  note: "noteId",
};
const TARGET_COLUMN: Record<LinkTargetKind, "projectId" | "characterId" | "worldId" | "plotId" | "chapterId" | "sceneId" | "targetNoteId"> = {
  project: "projectId",
  character: "characterId",
  world: "worldId",
  plot: "plotId",
  chapter: "chapterId",
  scene: "sceneId",
  note: "targetNoteId",
};

async function assertSourceExists(db: Tx, kind: LinkSourceKind, id: string) {
  const found =
    kind === "book"
      ? await db.book.findUnique({ where: { id }, select: { id: true } })
      : kind === "quote"
        ? await db.quote.findUnique({ where: { id }, select: { id: true } })
        : kind === "knowledge"
          ? await db.knowledgeNote.findUnique({ where: { id }, select: { id: true } })
          : await db.creativeNote.findUnique({ where: { id }, select: { id: true } });
  if (!found) throw new NotFoundError(kind === "book" ? "本" : kind === "quote" ? "フレーズ" : kind === "knowledge" ? "知識" : "創作メモ");
}

/** 紐付け先から作品 ID を求める（作品内の要素なら必ず作品にも属させる） */
async function resolveProjectId(db: Tx, kind: LinkTargetKind, id: string): Promise<string | null> {
  switch (kind) {
    case "project": {
      const p = await db.novelProject.findUnique({ where: { id }, select: { id: true } });
      if (!p) throw new NotFoundError("作品");
      return p.id;
    }
    case "character":
    case "world":
    case "plot":
    case "chapter": {
      const row =
        kind === "character"
          ? await db.character.findUnique({ where: { id }, select: { projectId: true } })
          : kind === "world"
            ? await db.worldSetting.findUnique({ where: { id }, select: { projectId: true } })
            : kind === "plot"
              ? await db.plot.findUnique({ where: { id }, select: { projectId: true } })
              : await db.chapter.findUnique({ where: { id }, select: { projectId: true } });
      if (!row) throw new NotFoundError(LINK_TARGET_LABEL[kind]);
      return row.projectId;
    }
    case "scene": {
      const s = await db.scene.findUnique({ where: { id }, select: { chapter: { select: { projectId: true } } } });
      if (!s) throw new NotFoundError("シーン");
      return s.chapter.projectId;
    }
    case "note": {
      const n = await db.creativeNote.findUnique({ where: { id }, select: { id: true } });
      if (!n) throw new NotFoundError("創作メモ");
      return null;
    }
  }
}

/** 紐付けを作成（同じ組み合わせが既にあれば用途だけ更新） */
export async function createLink(db: Db, input: LinkInput) {
  const data = linkInputSchema.parse(input);
  if (data.source.kind === "note" && data.target.kind === "note" && data.source.id === data.target.id) {
    throw new AppError("同じメモ同士は関連付けできません", "VALIDATION");
  }
  await assertSourceExists(db, data.source.kind, data.source.id);
  const projectId = await resolveProjectId(db, data.target.kind, data.target.id);
  const where: Prisma.CreativeLinkWhereInput = {
    [SOURCE_COLUMN[data.source.kind]]: data.source.id,
    [TARGET_COLUMN[data.target.kind]]: data.target.id,
  };
  if (data.target.kind === "project") {
    // 作品全体への紐付けは、作品内の要素への紐付けと区別する
    Object.assign(where, { characterId: null, worldId: null, plotId: null, chapterId: null, sceneId: null });
  }
  const existing = await db.creativeLink.findFirst({ where });
  if (existing) return db.creativeLink.update({ where: { id: existing.id }, data: { purpose: data.purpose } });
  const link = await db.creativeLink.create({
    data: {
      [SOURCE_COLUMN[data.source.kind]]: data.source.id,
      [TARGET_COLUMN[data.target.kind]]: data.target.id,
      ...(data.target.kind !== "project" && projectId ? { projectId } : {}),
      purpose: data.purpose,
    },
  });
  // 作品で使い始めた創作メモは「使用中」にする
  if (data.source.kind === "note" && projectId) {
    await db.creativeNote.updateMany({ where: { id: data.source.id, status: "IDEA" }, data: { status: "IN_USE" } });
  }
  return link;
}

export async function updateLinkPurpose(db: Db, id: string, purpose: string | null) {
  return db.creativeLink.update({ where: { id }, data: { purpose: purpose?.trim().slice(0, 60) || null } });
}

export async function deleteLink(db: Db, id: string) {
  await db.creativeLink.deleteMany({ where: { id } });
}

/* ---------------- 表示用ラベル ---------------- */

type TargetLinkRow = Prisma.CreativeLinkGetPayload<{ include: typeof linkTargetInclude }>;
type SourceLinkRow = Prisma.CreativeLinkGetPayload<{ include: typeof linkSourceInclude }>;

export function describeTarget(l: TargetLinkRow): { kind: LinkTargetKind; label: string; href: string; projectId: string | null; projectTitle: string | null } {
  if (l.scene) return { kind: "scene", label: l.scene.title, href: `/creative/projects/${l.scene.chapter.projectId}/scenes/${l.scene.id}`, projectId: l.scene.chapter.projectId, projectTitle: l.project?.title ?? null };
  if (l.chapter) return { kind: "chapter", label: l.chapter.title, href: `/creative/projects/${l.chapter.projectId}/chapters/${l.chapter.id}`, projectId: l.chapter.projectId, projectTitle: l.project?.title ?? null };
  if (l.character) return { kind: "character", label: l.character.name, href: `/creative/projects/${l.character.projectId}/characters/${l.character.id}`, projectId: l.character.projectId, projectTitle: l.project?.title ?? null };
  if (l.world) return { kind: "world", label: l.world.title, href: `/creative/projects/${l.world.projectId}/world`, projectId: l.world.projectId, projectTitle: l.project?.title ?? null };
  if (l.plot) return { kind: "plot", label: l.plot.title, href: `/creative/projects/${l.plot.projectId}/plots`, projectId: l.plot.projectId, projectTitle: l.project?.title ?? null };
  if (l.targetNote) return { kind: "note", label: l.targetNote.title, href: `/creative/notes/${l.targetNote.id}`, projectId: null, projectTitle: null };
  return { kind: "project", label: l.project?.title ?? "作品", href: `/creative/projects/${l.projectId}`, projectId: l.projectId, projectTitle: l.project?.title ?? null };
}

export function describeSource(l: SourceLinkRow): { kind: LinkSourceKind; label: string; sub?: string; href: string } {
  if (l.book) return { kind: "book", label: `『${l.book.title}』`, href: `/books/${l.book.id}` };
  if (l.quote) return { kind: "quote", label: quoted(`${l.quote.text.slice(0, 60)}${l.quote.text.length > 60 ? "…" : ""}`), sub: l.quote.book ? `『${l.quote.book.title}』` : undefined, href: `/quotes/${l.quote.id}` };
  if (l.knowledge) return { kind: "knowledge", label: l.knowledge.title, href: `/knowledge/${l.knowledge.id}` };
  const cat = (l.note?.category ?? "OTHER") as CreativeCategory;
  return { kind: "note", label: l.note?.title ?? "創作メモ", sub: CREATIVE_CATEGORY_LABEL[cat], href: `/creative/notes/${l.note?.id}` };
}

/* ---------------- 逆引き：本・フレーズ・知識が創作にどう使われているか ---------------- */

export interface CreativeUsage {
  projects: { id: string; title: string; counts: Partial<Record<LinkTargetKind, number>>; items: { kind: LinkTargetKind; label: string; href: string; purpose: string | null; via?: string; linkId?: string }[] }[];
  notes: { id: string; title: string; category: string; linkId: string }[];
  total: number;
}

export async function creativeUsageOf(db: Db, source: { kind: Exclude<LinkSourceKind, "note">; id: string }): Promise<CreativeUsage> {
  const column = SOURCE_COLUMN[source.kind];
  const direct = await db.creativeLink.findMany({ where: { [column]: source.id }, include: linkTargetInclude, orderBy: { createdAt: "desc" } });
  // この資料から作られた創作メモ → そのメモを使っている作品（1段階たどる）
  const noteIds = direct.filter((l) => l.targetNote).map((l) => l.targetNote!.id);
  const viaNotes = noteIds.length
    ? await db.creativeLink.findMany({ where: { noteId: { in: noteIds } }, include: { ...linkTargetInclude, note: { select: { title: true } } } })
    : [];
  const projects = new Map<string, CreativeUsage["projects"][number]>();
  const add = (l: TargetLinkRow, via?: string) => {
    const t = describeTarget(l);
    if (!t.projectId) return;
    const p = projects.get(t.projectId) ?? { id: t.projectId, title: t.projectTitle ?? "作品", counts: {}, items: [] };
    p.counts[t.kind] = (p.counts[t.kind] ?? 0) + 1;
    // 直接の紐付けだけ、ここから解除できるよう ID を渡す（メモ経由のものはメモ側で解除する）
    p.items.push({ kind: t.kind, label: t.label, href: t.href, purpose: l.purpose, via, linkId: via ? undefined : l.id });
    projects.set(t.projectId, p);
  };
  for (const l of direct) add(l);
  for (const l of viaNotes) add(l, (l as unknown as { note: { title: string } | null }).note?.title ?? undefined);
  const notes = direct.filter((l) => l.targetNote).map((l) => ({ id: l.targetNote!.id, title: l.targetNote!.title, category: l.targetNote!.category, linkId: l.id }));
  return { projects: [...projects.values()], notes, total: direct.length + viaNotes.length };
}

/* ---------------- 類似メモ検索 ---------------- */

/**
 * 類似創作メモの検索（MVP：文字の 2-gram の重なりによる類似度）
 * 将来 Embedding / ベクトル検索に置き換える場合は、この関数の実装だけを差し替える。
 */
function bigrams(text: string) {
  const t = text.normalize("NFKC").toLowerCase().replace(/[\s、。！？!?「」『』（）()・,.]/g, "");
  const set = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
}

export async function findSimilarNotes(db: Db, text: string, opts: { excludeId?: string; take?: number } = {}) {
  const base = bigrams(text);
  if (base.size < 2) return [];
  const notes = await db.creativeNote.findMany({
    where: { id: opts.excludeId ? { not: opts.excludeId } : undefined },
    select: { id: true, title: true, content: true, category: true, status: true },
    orderBy: { updatedAt: "desc" },
    take: 1000,
  });
  return notes
    .map((n) => {
      const g = bigrams(`${n.title} ${n.content}`);
      let inter = 0;
      for (const x of base) if (g.has(x)) inter++;
      const score = inter / Math.max(1, Math.min(base.size, g.size));
      return { ...n, score };
    })
    .filter((n) => n.score >= 0.12)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.take ?? 5);
}

/* ---------------- 紐付け先の選択肢（作品とその中の要素） ---------------- */

export async function listCreativeTargets(db: Db) {
  return db.novelProject.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      characters: { select: { id: true, name: true, role: true }, orderBy: { position: "asc" } },
      worldSettings: { select: { id: true, title: true, category: true }, orderBy: { createdAt: "asc" } },
      plots: { select: { id: true, title: true }, orderBy: { position: "asc" } },
      chapters: { select: { id: true, title: true, scenes: { select: { id: true, title: true }, orderBy: { position: "asc" } } }, orderBy: { position: "asc" } },
    },
  });
}
export type CreativeTargets = Awaited<ReturnType<typeof listCreativeTargets>>;

export async function pickCreativeNotes(db: Db, q: string) {
  return db.creativeNote.findMany({
    where: q ? buildNoteWhere({ q }) : { status: { not: "ARCHIVED" } },
    select: { id: true, title: true, category: true, status: true },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });
}
