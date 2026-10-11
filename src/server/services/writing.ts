/**
 * 執筆：作品の目次と、シーン本文の執筆画面（自動保存）。
 */
import type { Db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { countChars } from "@/lib/manuscript";
import { sceneContentSchema } from "@/lib/validators";
import { SCENE_STATUSES } from "@/lib/constants";

const ORDER = [{ position: "asc" as const }, { createdAt: "asc" as const }];

export interface TocScene {
  id: string;
  title: string;
  status: string;
  chars: number;
  updatedAt: Date;
}
export interface TocChapter {
  id: string;
  title: string;
  chars: number;
  scenes: TocScene[];
}

/** 作品の目次：章ごとのシーンと文字数、最後に書いていたシーン */
export async function projectToc(db: Db, projectId: string) {
  const chapters = await db.chapter.findMany({
    where: { projectId },
    orderBy: ORDER,
    select: { id: true, title: true, scenes: { orderBy: ORDER, select: { id: true, title: true, status: true, content: true, updatedAt: true } } },
  });
  const toc: TocChapter[] = chapters.map((c) => {
    const scenes = c.scenes.map((s) => ({ id: s.id, title: s.title, status: s.status, chars: countChars(s.content ?? ""), updatedAt: s.updatedAt }));
    return { id: c.id, title: c.title, chars: scenes.reduce((n, s) => n + s.chars, 0), scenes };
  });
  const all = toc.flatMap((c) => c.scenes.map((s) => ({ ...s, chapterTitle: c.title })));
  // 「続きを書く」：本文のあるシーンのうち最後に更新したもの。まだ本文がなければ最初のシーン
  const written = all.filter((s) => s.chars > 0);
  const resume = written.length ? written.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a)) : (all[0] ?? null);
  return { chapters: toc, totalChars: toc.reduce((n, c) => n + c.chars, 0), sceneCount: all.length, resume };
}

/** 執筆画面：シーン本文と、前後のシーン（章をまたいで本文の順に並べたとき） */
export async function sceneForWriting(db: Db, sceneId: string) {
  const s = await db.scene.findUnique({
    where: { id: sceneId },
    select: { id: true, title: true, status: true, content: true, updatedAt: true, chapter: { select: { id: true, title: true, project: { select: { id: true, title: true } } } } },
  });
  if (!s) return null;
  const projectId = s.chapter.project.id;
  const order = await db.chapter.findMany({ where: { projectId }, orderBy: ORDER, select: { title: true, scenes: { orderBy: ORDER, select: { id: true, title: true } } } });
  const flat = order.flatMap((c) => c.scenes.map((x) => ({ ...x, chapterTitle: c.title })));
  const i = flat.findIndex((x) => x.id === s.id);
  return {
    id: s.id,
    title: s.title,
    status: s.status,
    content: s.content ?? "",
    updatedAt: s.updatedAt,
    chapter: { id: s.chapter.id, title: s.chapter.title },
    project: s.chapter.project,
    prev: i > 0 ? flat[i - 1] : null,
    next: i >= 0 && i < flat.length - 1 ? flat[i + 1] : null,
  };
}

export type SaveSceneResult = { ok: true; updatedAt: string } | { ok: false; conflict: true; content: string; updatedAt: string };

/**
 * 本文の自動保存。
 * baseUpdatedAt（画面を開いたとき・前回保存したときの更新日時）より後に、別の端末などで本文が更新されていたら保存せずに知らせる。
 * force のときは上書きする。
 */
export async function saveSceneContent(db: Db, id: string, input: { content: string; baseUpdatedAt?: string | null; force?: boolean }): Promise<SaveSceneResult> {
  const { content } = sceneContentSchema.parse({ content: input.content });
  const cur = await db.scene.findUnique({ where: { id }, select: { content: true, updatedAt: true } });
  if (!cur) throw new NotFoundError("シーン");
  if (!input.force && input.baseUpdatedAt && cur.updatedAt.toISOString() !== input.baseUpdatedAt) {
    // 内容が同じなら衝突ではない（同じ文章を2回送った場合など）
    if ((cur.content ?? "") !== (content ?? "")) return { ok: false, conflict: true, content: cur.content ?? "", updatedAt: cur.updatedAt.toISOString() };
  }
  const saved = await db.scene.update({ where: { id }, data: { content: content ?? null }, select: { updatedAt: true } });
  return { ok: true, updatedAt: saved.updatedAt.toISOString() };
}

export async function setSceneStatus(db: Db, id: string, status: string) {
  if (!(SCENE_STATUSES as readonly string[]).includes(status)) throw new AppError("状態が正しくありません", "VALIDATION");
  return db.scene.update({ where: { id }, data: { status }, select: { id: true, updatedAt: true } });
}
