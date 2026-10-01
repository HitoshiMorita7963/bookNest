import "server-only";
/**
 * AI 編集者が使う創作データ用のツール。
 * 毎回すべてを送らず、質問に応じて必要なものだけを検索して返す。
 */
import type { Db } from "@/lib/db";
import { CREATIVE_CATEGORY_LABEL, type CreativeCategory } from "@/lib/constants";
import { findSimilarNotes, buildNoteWhere } from "@/server/services/creative";
import type { AiToolDef } from "./provider";

export type CreativeRefKind = "note" | "project" | "character" | "world" | "plot" | "chapter" | "scene";
export interface CreativeRef {
  kind: CreativeRefKind;
  id: string;
  label: string;
  href: string;
}
export type CreativeRefs = Map<string, CreativeRef>; // key: `${kind}:${id}`

export const remember = (refs: CreativeRefs, r: CreativeRef) => refs.set(`${r.kind}:${r.id}`, r);
const clip = (s: string | null | undefined, n = 300) => (s ? (s.length > n ? s.slice(0, n) + "…" : s) : null);

export const CREATIVE_TOOLS: AiToolDef[] = [
  {
    name: "search_creative",
    description: "創作データ（創作メモ・人物・世界観・プロット・章・シーン）をキーワードで検索する。scope=project で現在の作品内のみ、all で全作品・全メモを対象にする。",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" }, scope: { type: "string", enum: ["project", "all"] } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_project_structure",
    description: "現在の作品の人物一覧・世界観・プロット・章とシーンの一覧（概要つき）を返す。",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_character",
    description: "人物の詳細（役割・年齢・外見・性格・過去・目的・葛藤・話し方・メモ・関係・参考資料）を返す。",
    input_schema: { type: "object", properties: { character_id: { type: "string" } }, required: ["character_id"], additionalProperties: false },
  },
  {
    name: "get_chapter",
    description: "章の概要と、その章のシーン（概要・状態・下書きの冒頭）と参考資料を返す。",
    input_schema: { type: "object", properties: { chapter_id: { type: "string" } }, required: ["chapter_id"], additionalProperties: false },
  },
  {
    name: "list_project_references",
    description: "この作品に関連付けられた参考資料（本・フレーズ・知識・創作メモ）と、その用途・紐付け先を返す。",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "find_similar_notes",
    description: "与えた文章に似ている過去の創作メモを探す（文字の重なりによる類似検索）。",
    input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false },
  },
];

export async function runCreativeTool(db: Db, name: string, rawInput: unknown, projectId: string, refs: CreativeRefs, sources: { books: Map<string, string>; quotes: Map<string, string>; knowledge: Map<string, string> }): Promise<string> {
  const input = (rawInput ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof input[k] === "string" ? (input[k] as string).slice(0, 200) : "");
  const p = `/creative/projects/${projectId}`;

  switch (name) {
    case "search_creative": {
      const q = str("query");
      const scopeAll = str("scope") === "all";
      const terms = q.split(/\s+/).filter(Boolean).slice(0, 5);
      const textOr = (fields: string[]) => ({ AND: terms.map((t) => ({ OR: fields.map((f) => ({ [f]: { contains: t } })) })) });
      const inProject = scopeAll ? {} : { projectId };
      const [notes, characters, worlds, plots, chapters, scenes] = await Promise.all([
        db.creativeNote.findMany({ where: { AND: [buildNoteWhere({ q }), ...(scopeAll ? [] : [{ usedIn: { some: { projectId } } }])] }, take: 15, orderBy: { updatedAt: "desc" } }),
        db.character.findMany({ where: { ...inProject, ...textOr(["name", "role", "personality", "background", "goal", "conflict", "notes"]) }, take: 10 }),
        db.worldSetting.findMany({ where: { ...inProject, ...textOr(["title", "category", "content"]) }, take: 10 }),
        db.plot.findMany({ where: { ...inProject, ...textOr(["title", "summary", "notes"]) }, take: 10 }),
        db.chapter.findMany({ where: { ...inProject, ...textOr(["title", "summary"]) }, take: 10 }),
        db.scene.findMany({ where: { ...(scopeAll ? {} : { chapter: { projectId } }), ...textOr(["title", "summary", "content"]) }, include: { chapter: { select: { projectId: true, title: true } } }, take: 10 }),
      ]);
      notes.forEach((n) => remember(refs, { kind: "note", id: n.id, label: n.title, href: `/creative/notes/${n.id}` }));
      characters.forEach((c) => remember(refs, { kind: "character", id: c.id, label: c.name, href: `/creative/projects/${c.projectId}/characters/${c.id}` }));
      chapters.forEach((c) => remember(refs, { kind: "chapter", id: c.id, label: c.title, href: `/creative/projects/${c.projectId}/chapters/${c.id}` }));
      scenes.forEach((s) => remember(refs, { kind: "scene", id: s.id, label: s.title, href: `/creative/projects/${s.chapter.projectId}/scenes/${s.id}` }));
      worlds.forEach((w) => remember(refs, { kind: "world", id: w.id, label: w.title, href: `/creative/projects/${w.projectId}/world` }));
      plots.forEach((x) => remember(refs, { kind: "plot", id: x.id, label: x.title, href: `/creative/projects/${x.projectId}/plots` }));
      return JSON.stringify({
        notes: notes.map((n) => ({ id: n.id, title: n.title, category: CREATIVE_CATEGORY_LABEL[n.category as CreativeCategory] ?? n.category, status: n.status, content: clip(n.content) })),
        characters: characters.map((c) => ({ id: c.id, name: c.name, role: c.role, personality: clip(c.personality, 150), goal: clip(c.goal, 150), conflict: clip(c.conflict, 150) })),
        worldSettings: worlds.map((w) => ({ id: w.id, title: w.title, category: w.category, content: clip(w.content, 200) })),
        plots: plots.map((x) => ({ id: x.id, title: x.title, summary: clip(x.summary, 200) })),
        chapters: chapters.map((c) => ({ id: c.id, title: c.title, summary: clip(c.summary, 200) })),
        scenes: scenes.map((s) => ({ id: s.id, title: s.title, chapter: s.chapter.title, summary: clip(s.summary, 200) })),
      });
    }
    case "get_project_structure": {
      const proj = await db.novelProject.findUnique({
        where: { id: projectId },
        include: {
          characters: { orderBy: { position: "asc" } },
          worldSettings: { orderBy: { createdAt: "asc" } },
          plots: { orderBy: { position: "asc" } },
          chapters: { orderBy: { position: "asc" }, include: { scenes: { orderBy: { position: "asc" } } } },
          relationships: { include: { from: { select: { name: true } }, to: { select: { name: true } } } },
        },
      });
      if (!proj) return JSON.stringify({ error: "作品が見つかりません" });
      proj.characters.forEach((c) => remember(refs, { kind: "character", id: c.id, label: c.name, href: `${p}/characters/${c.id}` }));
      proj.chapters.forEach((c) => remember(refs, { kind: "chapter", id: c.id, label: c.title, href: `${p}/chapters/${c.id}` }));
      return JSON.stringify({
        characters: proj.characters.map((c) => ({ id: c.id, name: c.name, role: c.role, goal: clip(c.goal, 120), conflict: clip(c.conflict, 120) })),
        relationships: proj.relationships.map((r) => `${r.from.name} → ${r.label} → ${r.to.name}`),
        worldSettings: proj.worldSettings.map((w) => ({ id: w.id, title: w.title, category: w.category, content: clip(w.content, 150) })),
        plots: proj.plots.map((x, i) => ({ id: x.id, order: i + 1, title: x.title, status: x.status, summary: clip(x.summary, 150) })),
        chapters: proj.chapters.map((c, i) => ({ id: c.id, order: i + 1, title: c.title, summary: clip(c.summary, 150), scenes: c.scenes.map((s) => ({ id: s.id, title: s.title, status: s.status, summary: clip(s.summary, 100) })) })),
      });
    }
    case "get_character": {
      const c = await db.character.findFirst({
        where: { id: str("character_id"), projectId },
        include: {
          relationsFrom: { include: { to: { select: { name: true } } } },
          relationsTo: { include: { from: { select: { name: true } } } },
          links: { include: { book: { select: { id: true, title: true } }, quote: { select: { id: true, text: true } }, knowledge: { select: { id: true, title: true } }, note: { select: { id: true, title: true } } } },
        },
      });
      if (!c) return JSON.stringify({ error: "人物が見つかりません" });
      remember(refs, { kind: "character", id: c.id, label: c.name, href: `${p}/characters/${c.id}` });
      for (const l of c.links) {
        if (l.book) sources.books.set(l.book.id, l.book.title);
        if (l.quote) sources.quotes.set(l.quote.id, l.quote.text);
        if (l.knowledge) sources.knowledge.set(l.knowledge.id, l.knowledge.title);
        if (l.note) remember(refs, { kind: "note", id: l.note.id, label: l.note.title, href: `/creative/notes/${l.note.id}` });
      }
      return JSON.stringify({
        id: c.id,
        name: c.name,
        role: c.role,
        age: c.age,
        appearance: clip(c.appearance),
        personality: clip(c.personality),
        background: clip(c.background, 600),
        goal: clip(c.goal),
        conflict: clip(c.conflict),
        speechStyle: clip(c.speechStyle),
        notes: clip(c.notes, 600),
        relationships: [...c.relationsFrom.map((r) => `→ ${r.label} → ${r.to.name}`), ...c.relationsTo.map((r) => `${r.from.name} → ${r.label} →（この人物）`)],
        references: c.links.map((l) => ({ purpose: l.purpose, book: l.book?.title, quote: clip(l.quote?.text, 120), knowledge: l.knowledge?.title, note: l.note?.title })),
      });
    }
    case "get_chapter": {
      const ch = await db.chapter.findFirst({
        where: { id: str("chapter_id"), projectId },
        include: { scenes: { orderBy: { position: "asc" } }, links: { include: { book: { select: { id: true, title: true } }, quote: { select: { id: true, text: true } }, knowledge: { select: { id: true, title: true } }, note: { select: { id: true, title: true } } } } },
      });
      if (!ch) return JSON.stringify({ error: "章が見つかりません" });
      remember(refs, { kind: "chapter", id: ch.id, label: ch.title, href: `${p}/chapters/${ch.id}` });
      ch.scenes.forEach((s) => remember(refs, { kind: "scene", id: s.id, label: s.title, href: `${p}/scenes/${s.id}` }));
      for (const l of ch.links) {
        if (l.book) sources.books.set(l.book.id, l.book.title);
        if (l.quote) sources.quotes.set(l.quote.id, l.quote.text);
        if (l.knowledge) sources.knowledge.set(l.knowledge.id, l.knowledge.title);
      }
      return JSON.stringify({
        id: ch.id,
        title: ch.title,
        summary: clip(ch.summary, 600),
        scenes: ch.scenes.map((s) => ({ id: s.id, title: s.title, status: s.status, summary: clip(s.summary, 300), draftOpening: clip(s.content, 300) })),
        references: ch.links.map((l) => ({ purpose: l.purpose, book: l.book?.title, quote: clip(l.quote?.text, 120), knowledge: l.knowledge?.title, note: l.note?.title })),
      });
    }
    case "list_project_references": {
      const links = await db.creativeLink.findMany({
        where: { projectId },
        include: {
          book: { select: { id: true, title: true } },
          quote: { select: { id: true, text: true, book: { select: { title: true } } } },
          knowledge: { select: { id: true, title: true, content: true } },
          note: { select: { id: true, title: true, content: true } },
          character: { select: { name: true } },
          chapter: { select: { title: true } },
          scene: { select: { title: true } },
        },
        take: 80,
      });
      for (const l of links) {
        if (l.book) sources.books.set(l.book.id, l.book.title);
        if (l.quote) sources.quotes.set(l.quote.id, l.quote.text);
        if (l.knowledge) sources.knowledge.set(l.knowledge.id, l.knowledge.title);
        if (l.note) remember(refs, { kind: "note", id: l.note.id, label: l.note.title, href: `/creative/notes/${l.note.id}` });
      }
      return JSON.stringify({
        references: links.map((l) => ({
          purpose: l.purpose,
          usedFor: l.character ? `人物：${l.character.name}` : l.scene ? `シーン：${l.scene.title}` : l.chapter ? `章：${l.chapter.title}` : "作品全体",
          book: l.book ? { id: l.book.id, title: l.book.title } : undefined,
          quote: l.quote ? { id: l.quote.id, text: clip(l.quote.text, 200), book: l.quote.book?.title } : undefined,
          knowledge: l.knowledge ? { id: l.knowledge.id, title: l.knowledge.title, content: clip(l.knowledge.content, 200) } : undefined,
          note: l.note ? { id: l.note.id, title: l.note.title, content: clip(l.note.content, 200) } : undefined,
        })),
      });
    }
    case "find_similar_notes": {
      const notes = await findSimilarNotes(db, str("text"), { take: 8 });
      notes.forEach((n) => remember(refs, { kind: "note", id: n.id, label: n.title, href: `/creative/notes/${n.id}` }));
      return JSON.stringify({ notes: notes.map((n) => ({ id: n.id, title: n.title, category: n.category, content: clip(n.content, 200), similarity: Math.round(n.score * 100) / 100 })) });
    }
    default:
      return JSON.stringify({ error: `不明なツール: ${name}` });
  }
}
