/**
 * 創作知識の「参考にした読書」（Reference）。
 * 元は本・フレーズ・読書メモ（ReadingSession）・感想（ReadingRecord）・読書の知識のいずれか。本棚にない作品は作品名だけで登録できる。
 */
import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import type { CreativeKnowledgeInput } from "@/lib/validators";
import { CK_REFERENCE_KINDS, CK_REFERENCE_LABEL, type CkReferenceKind } from "@/lib/creative-knowledge";
import { createCreativeKnowledge } from "./creative-knowledge";

type Tx = Prisma.TransactionClient | Db;

const REF_COLUMN: Record<CkReferenceKind, "bookId" | "quoteId" | "sessionId" | "recordId" | "knowledgeNoteId"> = {
  book: "bookId",
  quote: "quoteId",
  session: "sessionId",
  record: "recordId",
  knowledgeNote: "knowledgeNoteId",
};

export interface CkReferenceInput {
  knowledgeId: string;
  /** 本棚の読書データ。なければ workTitle（本棚にない作品名）が必要 */
  source?: { kind: CkReferenceKind; id: string } | null;
  workTitle?: string | null;
  location?: string | null;
  comment?: string | null;
}

async function assertReferenceSource(db: Tx, kind: CkReferenceKind, id: string) {
  if (!(CK_REFERENCE_KINDS as readonly string[]).includes(kind)) throw new AppError("参考にした読書の種類が正しくありません", "VALIDATION");
  const count =
    kind === "book"
      ? await db.book.count({ where: { id } })
      : kind === "quote"
        ? await db.quote.count({ where: { id } })
        : kind === "session"
          ? await db.readingSession.count({ where: { id } })
          : kind === "record"
            ? await db.readingRecord.count({ where: { id } })
            : await db.knowledgeNote.count({ where: { id } });
  if (!count) throw new NotFoundError(CK_REFERENCE_LABEL[kind]);
}

/** 参考にした読書を追加する（同じ知識に同じ元が既にあれば、場所・気づきを更新する） */
export async function addCkReference(db: Db, input: CkReferenceInput) {
  if (!(await db.creativeKnowledge.count({ where: { id: input.knowledgeId } }))) throw new NotFoundError("創作知識");
  const workTitle = input.workTitle?.trim().slice(0, 200) || null;
  if (!input.source && !workTitle) throw new AppError("参考にした読書（本・フレーズなど）か、作品名を入力してください", "VALIDATION");
  const location = input.location?.trim().slice(0, 100) || null;
  const comment = input.comment?.trim().slice(0, 2000) ?? "";
  if (input.source) {
    await assertReferenceSource(db, input.source.kind, input.source.id);
    const column = REF_COLUMN[input.source.kind];
    const existing = await db.creativeKnowledgeReference.findFirst({ where: { knowledgeId: input.knowledgeId, [column]: input.source.id } });
    if (existing) {
      return db.creativeKnowledgeReference.update({ where: { id: existing.id }, data: { location: location ?? existing.location, comment: comment || existing.comment } });
    }
    return db.creativeKnowledgeReference.create({ data: { knowledgeId: input.knowledgeId, [column]: input.source.id, location, comment } });
  }
  return db.creativeKnowledgeReference.create({ data: { knowledgeId: input.knowledgeId, workTitle, location, comment } });
}

export async function updateCkReference(db: Db, id: string, input: { location?: string | null; comment?: string | null }) {
  return db.creativeKnowledgeReference.update({
    where: { id },
    data: { location: input.location?.trim().slice(0, 100) || null, comment: input.comment?.trim().slice(0, 2000) ?? "" },
  });
}

export async function removeCkReference(db: Db, id: string) {
  await db.creativeKnowledgeReference.deleteMany({ where: { id } });
}

/** 読書データから創作知識を作り、そのまま「参考にした読書」としてつなげる（「創作知識として保存」） */
export async function createCreativeKnowledgeFromSource(
  db: Db,
  input: CreativeKnowledgeInput,
  ref: { source: { kind: CkReferenceKind; id: string }; location?: string | null; comment?: string | null },
) {
  await assertReferenceSource(db, ref.source.kind, ref.source.id);
  const k = await createCreativeKnowledge(db, input);
  await addCkReference(db, { knowledgeId: k.id, source: ref.source, location: ref.location, comment: ref.comment });
  return k;
}

const refInclude = {
  book: { select: { id: true, title: true } },
  quote: { select: { id: true, text: true, pageNumber: true, book: { select: { id: true, title: true } } } },
  session: { select: { id: true, note: true, book: { select: { id: true, title: true } } } },
  record: { select: { id: true, review: true, learned: true, memorable: true, book: { select: { id: true, title: true } } } },
  knowledgeNote: { select: { id: true, title: true, content: true } },
} satisfies Prisma.CreativeKnowledgeReferenceInclude;
type RefRow = Prisma.CreativeKnowledgeReferenceGetPayload<{ include: typeof refInclude }>;

export interface CkReferenceView {
  id: string;
  kind: CkReferenceKind | "work";
  /** 何を参考にしたか（本のタイトル、フレーズの本文など） */
  label: string;
  /** 補足（フレーズの本、読書メモの本など） */
  sub: string | null;
  href: string | null;
  location: string | null;
  /** 自分の気づき */
  comment: string;
}

const clip = (s: string | null | undefined, n: number) => (s ? (s.length > n ? s.slice(0, n) + "…" : s) : "");

function describeReference(r: RefRow): CkReferenceView {
  const base = { id: r.id, location: r.location, comment: r.comment };
  if (r.quote) {
    const sub = r.quote.book ? `『${r.quote.book.title}』${r.quote.pageNumber ? ` ${r.quote.pageNumber}` : ""}` : null;
    return { ...base, kind: "quote", label: clip(r.quote.text, 80), sub, href: `/quotes/${r.quote.id}` };
  }
  if (r.session) return { ...base, kind: "session", label: clip(r.session.note, 80), sub: `『${r.session.book.title}』`, href: `/books/${r.session.book.id}` };
  if (r.record) {
    const text = clip(r.record.review || r.record.memorable || r.record.learned, 80) || "感想";
    return { ...base, kind: "record", label: text, sub: `『${r.record.book.title}』`, href: `/books/${r.record.book.id}` };
  }
  if (r.knowledgeNote) return { ...base, kind: "knowledgeNote", label: r.knowledgeNote.title, sub: clip(r.knowledgeNote.content, 60) || null, href: `/knowledge/${r.knowledgeNote.id}` };
  if (r.book) return { ...base, kind: "book", label: `『${r.book.title}』`, sub: null, href: `/books/${r.book.id}` };
  return { ...base, kind: "work", label: `『${r.workTitle ?? "作品"}』`, sub: "本棚にない作品", href: null };
}

/** 創作知識の「参考にした読書」 */
export async function ckReferencesOf(db: Db, knowledgeId: string): Promise<CkReferenceView[]> {
  const rows = await db.creativeKnowledgeReference.findMany({ where: { knowledgeId }, include: refInclude, orderBy: { createdAt: "asc" } });
  return rows.map(describeReference);
}

/**
 * 逆引き：本・フレーズ・読書メモ・感想・知識を参考にしている創作知識。
 * 本の場合は、その本のフレーズ・読書メモ・感想を参考にしたものも含める。
 */
export async function ckUsageOfSource(db: Db, source: { kind: CkReferenceKind; id: string }) {
  const where: Prisma.CreativeKnowledgeReferenceWhereInput =
    source.kind === "book"
      ? { OR: [{ bookId: source.id }, { quote: { bookId: source.id } }, { session: { bookId: source.id } }, { record: { bookId: source.id } }] }
      : { [REF_COLUMN[source.kind]]: source.id };
  const rows = await db.creativeKnowledgeReference.findMany({
    where,
    include: { knowledge: { select: { id: true, title: true, category: true } } },
    orderBy: { createdAt: "desc" },
  });
  const byKnowledge = new Map<string, { id: string; title: string; category: string; comments: string[] }>();
  for (const r of rows) {
    const cur = byKnowledge.get(r.knowledge.id) ?? { ...r.knowledge, comments: [] };
    if (r.comment) cur.comments.push(r.comment);
    byKnowledge.set(r.knowledge.id, cur);
  }
  return [...byKnowledge.values()];
}

export interface ReadingSourceOption {
  kind: CkReferenceKind;
  id: string;
  label: string;
  sub: string | null;
}

/** 「読書をつなげる」の候補：本・フレーズ・読書メモ・感想・知識を横断して探す */
export async function pickReadingSources(db: Db, q: string): Promise<ReadingSourceOption[]> {
  const t = q.trim().slice(0, 60);
  const take = 8;
  const [books, quotes, sessions, records, notes] = await Promise.all([
    db.book.findMany({ where: t ? { title: { contains: t } } : {}, select: { id: true, title: true }, orderBy: { updatedAt: "desc" }, take }),
    db.quote.findMany({
      where: t ? { OR: [{ text: { contains: t } }, { note: { contains: t } }, { book: { title: { contains: t } } }] } : {},
      select: { id: true, text: true, book: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take,
    }),
    db.readingSession.findMany({
      where: t ? { OR: [{ note: { contains: t } }, { book: { title: { contains: t } }, note: { not: null } }] } : { note: { not: null } },
      select: { id: true, note: true, book: { select: { title: true } } },
      orderBy: { date: "desc" },
      take,
    }),
    db.readingRecord.findMany({
      where: t
        ? { OR: [{ review: { contains: t } }, { memorable: { contains: t } }, { learned: { contains: t } }, { book: { title: { contains: t } } }] }
        : { OR: [{ review: { not: null } }, { memorable: { not: null } }, { learned: { not: null } }] },
      select: { id: true, review: true, memorable: true, learned: true, book: { select: { title: true } } },
      orderBy: { updatedAt: "desc" },
      take,
    }),
    db.knowledgeNote.findMany({ where: t ? { OR: [{ title: { contains: t } }, { content: { contains: t } }] } : {}, select: { id: true, title: true }, orderBy: { updatedAt: "desc" }, take }),
  ]);
  return [
    ...quotes.map((x) => ({ kind: "quote" as const, id: x.id, label: clip(x.text, 60), sub: x.book ? `『${x.book.title}』` : null })),
    ...sessions.filter((x) => x.note?.trim()).map((x) => ({ kind: "session" as const, id: x.id, label: clip(x.note, 60), sub: `『${x.book.title}』` })),
    ...records.map((x) => ({ kind: "record" as const, id: x.id, label: clip(x.review || x.memorable || x.learned, 60) || "感想", sub: `『${x.book.title}』` })),
    ...books.map((x) => ({ kind: "book" as const, id: x.id, label: `『${x.title}』`, sub: null })),
    ...notes.map((x) => ({ kind: "knowledgeNote" as const, id: x.id, label: x.title, sub: null })),
  ];
}
