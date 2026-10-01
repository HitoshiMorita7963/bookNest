import type { PrismaClient } from "@prisma/client";
import { bookMetadataService } from "./metadata";

/** 表紙がない本の数（ISBN があるものだけが自動取得の対象） */
export async function countMissingCovers(db: PrismaClient) {
  const where = { isbn13: { not: null }, OR: [{ coverImage: null }, { coverImage: "" }] };
  return db.book.count({ where });
}

/**
 * 表紙のない本の表紙をまとめて探す。
 * 1回の呼び出しでは limit 冊まで処理し（サーバーの実行時間制限対策）、画面側で残りがなくなるまで繰り返す。
 * skipIds には、すでに試して見つからなかった本を渡す（同じ本を何度も探さない）。
 */
export async function fillMissingCovers(
  db: PrismaClient,
  opts: { limit?: number; skipIds?: string[]; find?: (isbn13: string, title: string, authors: string[]) => Promise<string | null> } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 30);
  const find = opts.find ?? ((isbn13: string, title: string, authors: string[]) => bookMetadataService.findCover(isbn13, title, false, authors));
  const books = await db.book.findMany({
    where: { isbn13: { not: null }, OR: [{ coverImage: null }, { coverImage: "" }], id: { notIn: opts.skipIds ?? [] } },
    select: { id: true, title: true, isbn13: true, authors: { select: { author: { select: { name: true } } }, orderBy: { position: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const found: string[] = [];
  const notFound: string[] = [];
  // 外部APIに負荷をかけないよう、2冊ずつ並列で処理する
  for (let i = 0; i < books.length; i += 2) {
    await Promise.all(
      books.slice(i, i + 2).map(async (b) => {
        const url = await find(b.isbn13!, b.title, b.authors.map((a) => a.author.name)).catch(() => null);
        if (url) {
          await db.book.update({ where: { id: b.id }, data: { coverImage: url } });
          found.push(b.id);
        } else notFound.push(b.id);
      }),
    );
  }
  const remaining = await db.book.count({
    where: { isbn13: { not: null }, OR: [{ coverImage: null }, { coverImage: "" }], id: { notIn: [...(opts.skipIds ?? []), ...notFound] } },
  });
  return { processed: books.length, found: found.length, notFoundIds: notFound, remaining };
}
