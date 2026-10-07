/**
 * AI に渡す創作知識の文脈。
 * 毎回すべてを送らず、検索で見つかったものや作品に関連付けられたものだけを、短く切りそろえて渡す。
 * 一般的な知識（定義・効果など）と自分のメモ（myNote）は分けて渡し、AI が区別できるようにする。
 */
import type { Db } from "@/lib/db";
import { ckCategoryLabel, lines } from "@/lib/creative-knowledge";
import { ckRelationsOf } from "./creative-knowledge";
import { searchCreativeKnowledge } from "./creative-knowledge-search";

export interface CkAiContext {
  id: string;
  title: string;
  category: string;
  subCategory: string | null;
  summary: string;
  definition: string | null;
  effects: string[];
  patterns: string[];
  flow: string[];
  usage: string[];
  cautions: string[];
  /** 自分のメモ（一般的な知識ではなく、ユーザー自身の考え） */
  myNote: string | null;
  /** 例：「上位の知識：伏線」 */
  relations: string[];
  /** この作品で使っている場所（作品を指定したときだけ）。例：「人物：ミナ（敵対関係の動機）」 */
  usedInProject?: string[];
}

const clip = (s: string | null | undefined, n: number) => (s ? (s.length > n ? s.slice(0, n) + "…" : s) : null);
const items = (text: string, max = 5) => lines(text).slice(0, max).map((x) => clip(x, 80)!);

/** 指定した創作知識を AI 用に短くまとめる（並びは ids の順） */
export async function ckAiContext(db: Db, ids: string[], opts: { projectId?: string } = {}): Promise<CkAiContext[]> {
  const unique = [...new Set(ids)].slice(0, 20);
  if (!unique.length) return [];
  const rows = await db.creativeKnowledge.findMany({ where: { id: { in: unique } } });
  const uses = opts.projectId
    ? await db.creativeLink.findMany({
        where: { projectId: opts.projectId, ckId: { in: unique } },
        include: { character: { select: { name: true } }, chapter: { select: { title: true } }, scene: { select: { title: true } }, world: { select: { title: true } }, plot: { select: { title: true } } },
      })
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: CkAiContext[] = [];
  for (const id of unique) {
    const k = byId.get(id);
    if (!k) continue;
    const relations = (await ckRelationsOf(db, k.id)).slice(0, 8).map((r) => `${r.label}：${r.other.title}`);
    const usedIn = uses
      .filter((u) => u.ckId === k.id)
      .map((u) => {
        const where = u.character ? `人物：${u.character.name}` : u.scene ? `シーン：${u.scene.title}` : u.chapter ? `章：${u.chapter.title}` : u.world ? `世界観：${u.world.title}` : u.plot ? `プロット：${u.plot.title}` : "作品全体";
        return u.purpose ? `${where}（${u.purpose}）` : where;
      });
    out.push({
      id: k.id,
      title: k.title,
      category: ckCategoryLabel(k.category),
      subCategory: k.subCategory,
      summary: clip(k.summary, 200) ?? "",
      definition: clip(k.definition, 300),
      effects: items(k.effects),
      patterns: items(k.patterns),
      flow: items(k.flow, 8),
      usage: items(k.usage),
      cautions: items(k.cautions, 3),
      myNote: clip(k.myNote, 400),
      relations,
      ...(opts.projectId ? { usedInProject: usedIn } : {}),
    });
  }
  return out;
}

/** 質問に合う創作知識を探して、AI 用の文脈にする */
export async function searchCkForAi(db: Db, query: string, opts: { projectId?: string; take?: number } = {}) {
  const hits = await searchCreativeKnowledge(db, query, { take: opts.take ?? 6, withRelated: true });
  const contexts = await ckAiContext(db, hits.map((h) => h.item.id), opts);
  const reason = new Map(hits.map((h) => [h.item.id, h.reason]));
  return contexts.map((c) => ({ ...c, matched: reason.get(c.id) }));
}

/** 作品に関連付けられている創作知識（作品・人物・章・シーンなど、どこに付けたものでも） */
export async function projectCkContext(db: Db, projectId: string) {
  const links = await db.creativeLink.findMany({ where: { projectId, ckId: { not: null } }, select: { ckId: true }, orderBy: { createdAt: "desc" }, take: 40 });
  return ckAiContext(db, links.map((l) => l.ckId!), { projectId });
}
