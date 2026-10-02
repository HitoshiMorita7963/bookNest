/**
 * 小説プロジェクト：作品・人物・人物関係・世界観・プロット・章・シーン
 * 影響（参考資料）の集計と、読書と創作を一つの時間軸で見る「創作タイムライン」
 */
import { format } from "date-fns";
import type { Db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import {
  chapterInputSchema,
  characterInputSchema,
  plotInputSchema,
  projectInputSchema,
  relationshipInputSchema,
  sceneInputSchema,
  worldInputSchema,
  type ChapterInput,
  type CharacterInput,
  type PlotInput,
  type ProjectInput,
  type SceneInput,
  type WorldInput,
} from "@/lib/validators";
import { describeSource, describeTarget, linkSourceInclude, linkTargetInclude } from "./creative";
import { quoted } from "@/lib/quote-marks";

/* ---------------- 作品 ---------------- */

export async function createProject(db: Db, input: ProjectInput, opts: { isSample?: boolean } = {}) {
  const data = projectInputSchema.parse(input);
  return db.novelProject.create({ data: { ...data, isSample: opts.isSample ?? false } });
}

export async function updateProject(db: Db, id: string, input: ProjectInput) {
  const data = projectInputSchema.parse(input);
  await mustProject(db, id);
  return db.novelProject.update({ where: { id }, data });
}

export async function deleteProject(db: Db, id: string) {
  await mustProject(db, id);
  await db.$transaction(async (tx) => {
    // AI 編集者の会話は外部キーを張っていないため、ここで削除する
    await tx.aIConversation.deleteMany({ where: { projectId: id } });
    await tx.novelProject.delete({ where: { id } });
  });
}

async function mustProject(db: Db, id: string) {
  const p = await db.novelProject.findUnique({ where: { id }, select: { id: true } });
  if (!p) throw new NotFoundError("作品");
  return p;
}

export async function listProjects(db: Db) {
  return db.novelProject.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { characters: true, chapters: true, worldSettings: true, plots: true, links: true } } },
  });
}

export async function getProject(db: Db, id: string) {
  return db.novelProject.findUnique({
    where: { id },
    include: {
      _count: { select: { characters: true, chapters: true, worldSettings: true, plots: true, links: true } },
    },
  });
}

/** 作品ページの見出し・タブ用の軽い情報 */
export async function getProjectHeader(db: Db, id: string) {
  return db.novelProject.findUnique({ where: { id }, select: { id: true, title: true, status: true } });
}

/* ---------------- 並び順の共通処理 ---------------- */

async function nextPosition(rows: { position: number }[]) {
  return rows.length ? Math.max(...rows.map((r) => r.position)) + 1 : 0;
}

type Orderable = "character" | "plot" | "chapter" | "scene";

/** 上下ボタンでの並び替え（position を詰め直す） */
export async function moveItem(db: Db, kind: Orderable, id: string, direction: -1 | 1) {
  const siblings = await (async () => {
    if (kind === "scene") {
      const s = await db.scene.findUnique({ where: { id }, select: { chapterId: true } });
      if (!s) throw new NotFoundError("シーン");
      return db.scene.findMany({ where: { chapterId: s.chapterId }, select: { id: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
    }
    const delegate = kind === "character" ? db.character : kind === "plot" ? db.plot : db.chapter;
    const row = await (delegate as typeof db.plot).findUnique({ where: { id }, select: { projectId: true } });
    if (!row) throw new NotFoundError("項目");
    return (delegate as typeof db.plot).findMany({ where: { projectId: row.projectId }, select: { id: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  })();
  const i = siblings.findIndex((s) => s.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= siblings.length) return;
  [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
  const delegate = (kind === "character" ? db.character : kind === "plot" ? db.plot : kind === "chapter" ? db.chapter : db.scene) as typeof db.plot;
  await db.$transaction(siblings.map((s, k) => delegate.update({ where: { id: s.id }, data: { position: k } })));
}

/* ---------------- 人物 ---------------- */

export async function createCharacter(db: Db, projectId: string, input: CharacterInput) {
  const data = characterInputSchema.parse(input);
  await mustProject(db, projectId);
  const rows = await db.character.findMany({ where: { projectId }, select: { position: true } });
  return db.character.create({ data: { ...data, projectId, position: await nextPosition(rows) } });
}

export async function updateCharacter(db: Db, id: string, input: CharacterInput) {
  const data = characterInputSchema.parse(input);
  return db.character.update({ where: { id }, data });
}

/** 1項目だけ更新（AI編集者の提案の採用など） */
export async function updateCharacterField(db: Db, id: string, field: keyof CharacterInput, value: string) {
  const cur = await db.character.findUnique({ where: { id } });
  if (!cur) throw new NotFoundError("人物");
  const next = { ...cur, [field]: value } as Record<string, unknown>;
  const data = characterInputSchema.parse(next);
  return db.character.update({ where: { id }, data });
}

export async function deleteCharacter(db: Db, id: string) {
  await db.character.delete({ where: { id } });
}

export async function getCharacter(db: Db, id: string) {
  return db.character.findUnique({
    where: { id },
    include: {
      relationsFrom: { include: { to: { select: { id: true, name: true } } } },
      relationsTo: { include: { from: { select: { id: true, name: true } } } },
      links: { include: linkSourceInclude, orderBy: { createdAt: "desc" } },
    },
  });
}

export async function createRelationship(db: Db, projectId: string, input: unknown) {
  const data = relationshipInputSchema.parse(input);
  if (data.fromId === data.toId) throw new AppError("同じ人物同士の関係は登録できません", "VALIDATION");
  const chars = await db.character.findMany({ where: { id: { in: [data.fromId, data.toId] }, projectId }, select: { id: true } });
  if (chars.length !== 2) throw new NotFoundError("人物");
  return db.characterRelationship.create({ data: { ...data, projectId } });
}

export async function deleteRelationship(db: Db, id: string) {
  await db.characterRelationship.deleteMany({ where: { id } });
}

/* ---------------- 世界観 ---------------- */

export async function createWorld(db: Db, projectId: string, input: WorldInput) {
  const data = worldInputSchema.parse(input);
  await mustProject(db, projectId);
  return db.worldSetting.create({ data: { ...data, projectId } });
}
export async function updateWorld(db: Db, id: string, input: WorldInput) {
  return db.worldSetting.update({ where: { id }, data: worldInputSchema.parse(input) });
}
export async function deleteWorld(db: Db, id: string) {
  await db.worldSetting.delete({ where: { id } });
}

/* ---------------- プロット ---------------- */

export async function createPlot(db: Db, projectId: string, input: PlotInput) {
  const data = plotInputSchema.parse(input);
  await mustProject(db, projectId);
  const rows = await db.plot.findMany({ where: { projectId }, select: { position: true } });
  return db.plot.create({ data: { ...data, projectId, position: await nextPosition(rows) } });
}
export async function updatePlot(db: Db, id: string, input: PlotInput) {
  return db.plot.update({ where: { id }, data: plotInputSchema.parse(input) });
}
export async function deletePlot(db: Db, id: string) {
  await db.plot.delete({ where: { id } });
}

/* ---------------- 章・シーン ---------------- */

export async function createChapter(db: Db, projectId: string, input: ChapterInput) {
  const data = chapterInputSchema.parse(input);
  await mustProject(db, projectId);
  const rows = await db.chapter.findMany({ where: { projectId }, select: { position: true } });
  return db.chapter.create({ data: { ...data, projectId, position: await nextPosition(rows) } });
}
export async function updateChapter(db: Db, id: string, input: ChapterInput) {
  return db.chapter.update({ where: { id }, data: chapterInputSchema.parse(input) });
}
export async function deleteChapter(db: Db, id: string) {
  await db.chapter.delete({ where: { id } });
}

export async function getChapter(db: Db, id: string) {
  return db.chapter.findUnique({
    where: { id },
    include: {
      scenes: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], include: { _count: { select: { links: true } } } },
      links: { include: linkSourceInclude, orderBy: { createdAt: "desc" } },
    },
  });
}

export async function createScene(db: Db, chapterId: string, input: SceneInput) {
  const data = sceneInputSchema.parse(input);
  const ch = await db.chapter.findUnique({ where: { id: chapterId }, select: { id: true } });
  if (!ch) throw new NotFoundError("章");
  const rows = await db.scene.findMany({ where: { chapterId }, select: { position: true } });
  return db.scene.create({ data: { ...data, chapterId, position: await nextPosition(rows) } });
}
export async function updateScene(db: Db, id: string, input: SceneInput) {
  return db.scene.update({ where: { id }, data: sceneInputSchema.parse(input) });
}
export async function deleteScene(db: Db, id: string) {
  await db.scene.delete({ where: { id } });
}
export async function getScene(db: Db, id: string) {
  return db.scene.findUnique({
    where: { id },
    include: { chapter: { select: { id: true, title: true, projectId: true } }, links: { include: linkSourceInclude, orderBy: { createdAt: "desc" } } },
  });
}

/* ---------------- この作品に影響を与えたもの（参考資料） ---------------- */

export async function projectReferences(db: Db, projectId: string) {
  const links = await db.creativeLink.findMany({
    where: { projectId },
    include: { ...linkSourceInclude, ...linkTargetInclude, note: { select: { id: true, title: true, category: true, materials: { include: linkSourceInclude } } } },
    orderBy: { createdAt: "desc" },
  });
  const items = links.map((l) => ({ id: l.id, purpose: l.purpose, createdAt: l.createdAt, source: describeSource(l), target: describeTarget(l) }));
  // 創作メモを経由した資料（メモの元になった本・フレーズ・知識）も影響として数える
  const viaNotes = links.flatMap((l) => (l.note?.materials ?? []).map((m) => ({ id: m.id, via: l.note!.title, source: describeSource(m) })));
  const distinct = (kind: string) => new Set([...items, ...viaNotes].filter((i) => i.source.kind === kind).map((i) => i.source.href)).size;
  // フレーズの出典の本も「影響を与えた本」に含める
  const quoteBooks = links.filter((l) => l.quote?.book).map((l) => `/books/${l.quote!.book!.id}`);
  const bookHrefs = new Set([...items, ...viaNotes].filter((i) => i.source.kind === "book").map((i) => i.source.href).concat(quoteBooks));
  return {
    items,
    viaNotes,
    counts: { book: bookHrefs.size, quote: distinct("quote"), knowledge: distinct("knowledge"), note: distinct("note") },
  };
}

/* ---------------- 創作タイムライン ---------------- */

export interface TimelineEvent {
  date: Date;
  icon: string;
  label: string;
  href?: string;
  kind: "reading" | "creative";
}

export async function projectTimeline(db: Db, projectId: string): Promise<TimelineEvent[]> {
  const project = await db.novelProject.findUnique({
    where: { id: projectId },
    include: {
      characters: { select: { id: true, name: true, createdAt: true } },
      worldSettings: { select: { title: true, createdAt: true } },
      plots: { select: { title: true, createdAt: true } },
      chapters: { select: { id: true, title: true, createdAt: true, scenes: { select: { id: true, title: true, status: true, createdAt: true, updatedAt: true } } } },
    },
  });
  if (!project) return [];
  const refs = await db.creativeLink.findMany({
    where: { projectId },
    include: {
      book: { select: { id: true, title: true, startedAt: true, finishedAt: true } },
      quote: { select: { id: true, text: true, createdAt: true } },
      knowledge: { select: { id: true, title: true, createdAt: true } },
      note: { select: { id: true, title: true, createdAt: true } },
    },
  });
  const ev: TimelineEvent[] = [{ date: project.createdAt, icon: "✍️", label: `作品「${project.title}」を作成`, kind: "creative", href: `/creative/projects/${projectId}` }];
  const p = `/creative/projects/${projectId}`;
  for (const c of project.characters) ev.push({ date: c.createdAt, icon: "👤", label: `人物「${c.name}」を作成`, kind: "creative", href: `${p}/characters/${c.id}` });
  for (const w of project.worldSettings) ev.push({ date: w.createdAt, icon: "🌍", label: `世界観「${w.title}」を作成`, kind: "creative", href: `${p}/world` });
  for (const pl of project.plots) ev.push({ date: pl.createdAt, icon: "📋", label: `プロット「${pl.title}」を作成`, kind: "creative", href: `${p}/plots` });
  for (const ch of project.chapters) {
    ev.push({ date: ch.createdAt, icon: "📖", label: `章「${ch.title}」を作成`, kind: "creative", href: `${p}/chapters/${ch.id}` });
    for (const s of ch.scenes) {
      ev.push({ date: s.createdAt, icon: "🎬", label: `シーン「${s.title}」を作成`, kind: "creative", href: `${p}/scenes/${s.id}` });
      if (s.status === "COMPLETED") ev.push({ date: s.updatedAt, icon: "✅", label: `シーン「${s.title}」完成`, kind: "creative", href: `${p}/scenes/${s.id}` });
    }
  }
  const seen = new Set<string>();
  const once = (key: string, e: TimelineEvent) => {
    if (seen.has(key)) return;
    seen.add(key);
    ev.push(e);
  };
  for (const r of refs) {
    if (r.book) {
      if (r.book.startedAt) once(`bs${r.book.id}`, { date: r.book.startedAt, icon: "📚", label: `『${r.book.title}』を読み始めた`, kind: "reading", href: `/books/${r.book.id}` });
      if (r.book.finishedAt) once(`bf${r.book.id}`, { date: r.book.finishedAt, icon: "📚", label: `『${r.book.title}』読了`, kind: "reading", href: `/books/${r.book.id}` });
    }
    if (r.quote) once(`q${r.quote.id}`, { date: r.quote.createdAt, icon: "💬", label: `フレーズ保存${quoted(`${r.quote.text.slice(0, 24)}${r.quote.text.length > 24 ? "…" : ""}`)}`, kind: "reading", href: `/quotes/${r.quote.id}` });
    if (r.knowledge) once(`k${r.knowledge.id}`, { date: r.knowledge.createdAt, icon: "🧠", label: `知識「${r.knowledge.title}」を作成`, kind: "reading", href: `/knowledge/${r.knowledge.id}` });
    if (r.note) once(`n${r.note.id}`, { date: r.note.createdAt, icon: "💡", label: `創作メモ「${r.note.title}」を作成`, kind: "creative", href: `/creative/notes/${r.note.id}` });
    const what = r.book ? `『${r.book.title}』` : r.quote ? "フレーズ" : r.knowledge ? `知識「${r.knowledge.title}」` : r.note ? `メモ「${r.note.title}」` : "資料";
    ev.push({ date: r.createdAt, icon: "🔗", label: `${what}を参考資料に追加${r.purpose ? `（${r.purpose}）` : ""}`, kind: "creative" });
  }
  return ev.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function groupByDay(events: TimelineEvent[]) {
  const groups: { day: string; events: TimelineEvent[] }[] = [];
  for (const e of events) {
    const day = format(e.date, "yyyy/M/d");
    const g = groups[groups.length - 1];
    if (g && g.day === day) g.events.push(e);
    else groups.push({ day, events: [e] });
  }
  return groups;
}
