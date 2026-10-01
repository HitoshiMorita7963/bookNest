import "server-only";
/**
 * 保存操作のあとにスプレッドシートへ反映する。
 * 画面の応答を待たせないよう、レスポンス後（after）にバックグラウンドで送る。失敗してもアプリの保存には影響しない。
 */
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { sheetsConfigured, syncAll, syncItems, type SheetKind } from "@/server/services/sheets";

function later(task: () => Promise<unknown>) {
  if (!sheetsConfigured()) return;
  after(async () => {
    try {
      await task();
    } catch (e) {
      console.warn("[sheets] 反映に失敗しました:", (e as Error).message);
    }
  });
}

/** 指定したデータの行を追加・更新・削除する（DB にない ID は行を削除） */
export function syncSheetLater(kind: SheetKind, ...ids: (string | null | undefined)[]) {
  const list = ids.filter((x): x is string => !!x);
  if (list.length) later(() => syncItems(prisma, kind, list));
}

/** 本の変更（タイトル・著者）を、その本のフレーズ・知識の行に反映する */
export async function syncBookRowsLater(bookId: string) {
  if (!sheetsConfigured()) return;
  const [quotes, knowledge] = await Promise.all([
    prisma.quote.findMany({ where: { bookId }, select: { id: true } }),
    prisma.bookKnowledge.findMany({ where: { bookId }, select: { knowledgeId: true } }),
  ]);
  syncSheetLater("quote", ...quotes.map((q) => q.id));
  syncSheetLater("knowledge", ...knowledge.map((k) => k.knowledgeId));
}

/** インポートや全削除など、まとめて変わったときはシートを丸ごと書き直す */
export function syncAllLater() {
  later(() => syncAll(prisma));
}
