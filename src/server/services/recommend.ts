import type { Db } from "@/lib/db";
import { bookListInclude, type BookListItem } from "./books";

export interface Recommendation {
  book: BookListItem;
  reasons: string[];
  score: number;
}

const UNREAD = ["WANT_TO_READ", "OWNED", "PAUSED"];

/**
 * 次に読む本のルールベース推薦
 *  - 読書ルートの次の本 / 未読のシリーズ続巻 / 高評価著者の未読
 *  - 読書中・高評価本と同じタグ / 長く積んでいる本
 */
export async function recommendNext(db: Db, take = 8): Promise<Recommendation[]> {
  // 必要なデータは互いに独立しているので並行して取得する（クラウド DB での待ち時間を短縮）
  const [candidates, paths, seriesBooks, favAuthors, anchors] = await Promise.all([
    db.book.findMany({
      where: { status: { in: UNREAD } },
      include: { ...bookListInclude, tags: { select: { tagId: true } } },
      take: 500,
      orderBy: { updatedAt: "desc" },
    }),
    db.readingPath.findMany({
      include: { books: { orderBy: { position: "asc" }, include: { book: { select: { id: true, status: true } } } } },
    }),
    db.book.findMany({
      where: { seriesId: { not: null } },
      select: { id: true, seriesId: true, seriesNumber: true, status: true, series: { select: { title: true } } },
    }),
    db.bookAuthor.findMany({
      where: { book: { rating: { gte: 4 } } },
      select: { authorId: true, author: { select: { name: true } } },
    }),
    db.book.findMany({
      where: { OR: [{ status: "READING" }, { rating: { gte: 4 } }] },
      select: { status: true, tags: { select: { tagId: true, tag: { select: { name: true } } } } },
    }),
  ]);
  if (!candidates.length) return [];
  const map = new Map<string, Recommendation>(candidates.map((b) => [b.id, { book: b, reasons: [], score: 0 }]));
  const add = (id: string, reason: string, score: number) => {
    const r = map.get(id);
    if (!r) return;
    if (!r.reasons.includes(reason)) r.reasons.push(reason);
    r.score += score;
  };

  // 読書ルートの次の本
  for (const p of paths) {
    const next = p.books.find((pb) => pb.book.status !== "COMPLETED" && pb.book.status !== "DROPPED");
    if (next) add(next.book.id, `読書ルート「${p.title}」の次の本`, 6);
  }

  // シリーズの続巻（読了した巻の次の巻）
  const bySeries = new Map<string, typeof seriesBooks>();
  for (const b of seriesBooks) bySeries.set(b.seriesId!, [...(bySeries.get(b.seriesId!) ?? []), b]);
  for (const list of bySeries.values()) {
    const sorted = list.sort((a, b) => (a.seriesNumber ?? 0) - (b.seriesNumber ?? 0));
    const lastRead = sorted.filter((b) => b.status === "COMPLETED").pop();
    if (!lastRead) continue;
    const next = sorted.find((b) => (b.seriesNumber ?? 0) > (lastRead.seriesNumber ?? 0) && UNREAD.includes(b.status));
    if (next) add(next.id, `シリーズ「${next.series?.title}」の続き`, 5);
  }

  // 高評価（4以上）の著者の未読
  const favMap = new Map(favAuthors.map((a) => [a.authorId, a.author.name]));
  for (const c of candidates) {
    for (const a of c.authors) if (favMap.has(a.authorId)) add(c.id, `高評価した${favMap.get(a.authorId)}の作品`, 3);
  }

  // 読書中・高評価の本と同じタグ
  const readingTags = new Map<string, string>();
  const likedTags = new Map<string, string>();
  for (const a of anchors) for (const t of a.tags) (a.status === "READING" ? readingTags : likedTags).set(t.tagId, t.tag.name);
  for (const c of candidates) {
    const r = c.tags.filter((t) => readingTags.has(t.tagId));
    if (r.length) add(c.id, `読書中の本と同じ #${readingTags.get(r[0].tagId)}`, 1.5 * r.length);
    const l = c.tags.filter((t) => likedTags.has(t.tagId) && !readingTags.has(t.tagId));
    if (l.length) add(c.id, `高評価した本と同じ #${likedTags.get(l[0].tagId)}`, 1 * l.length);
  }

  // 積読期間が長い本
  const now = Date.now();
  for (const c of candidates) {
    if (c.status !== "OWNED") continue;
    const days = Math.floor((now - (c.acquiredAt ?? c.createdAt).getTime()) / 86400000);
    if (days >= 30) add(c.id, `積読 ${days}日`, Math.min(2, days / 180));
    else add(c.id, "積読", 0.5);
  }
  for (const c of candidates) if (c.status === "PAUSED") add(c.id, "中断中の本", 1);

  return [...map.values()]
    .filter((r) => r.reasons.length)
    .sort((a, b) => b.score - a.score)
    .slice(0, take);
}
