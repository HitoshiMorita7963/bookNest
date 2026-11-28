/**
 * 保存前に予約した「創作に使う」を、保存したあとで実行する（新しいフレーズの登録画面から）。
 * 1つ失敗しても残りは実行し、失敗した数を返す（フレーズ自体はもう保存されているため）。
 * noteIds：作った・つないだ創作メモ（スプレッドシート連携の更新用）
 */
import type { Db } from "@/lib/db";
import { creativeUsesSchema, type CreativeUse, type LinkInput } from "@/lib/validators";
import { createCreativeNote, createLink } from "./creative";
import { addCkReference, createCreativeKnowledgeFromSource } from "./creative-knowledge-references";

export async function applyCreativeUses(db: Db, source: { kind: "quote"; id: string }, input: CreativeUse[]) {
  const uses = creativeUsesSchema.parse(input);
  let failed = 0;
  const noteIds: string[] = [];
  for (const use of uses) {
    try {
      switch (use.type) {
        case "link":
          await createLink(db, { source, target: use.target as LinkInput["target"], purpose: use.purpose });
          if (use.target.kind === "note") noteIds.push(use.target.id);
          break;
        case "note": {
          const note = await createCreativeNote(db, use.note);
          noteIds.push(note.id);
          await createLink(db, { source, target: { kind: "note", id: note.id }, purpose: use.purpose });
          if (use.target) await createLink(db, { source: { kind: "note", id: note.id }, target: use.target as LinkInput["target"], purpose: use.purpose });
          break;
        }
        case "ck-new":
          await createCreativeKnowledgeFromSource(db, { title: use.ck.title, category: use.ck.category, subCategory: use.ck.subCategory }, { source, comment: use.comment, location: use.location });
          break;
        case "ck-ref":
          await addCkReference(db, { knowledgeId: use.knowledgeId, source, comment: use.comment, location: use.location });
          break;
      }
    } catch (e) {
      console.error("[creative-uses]", use.type, e);
      failed++;
    }
  }
  return { failed, noteIds };
}
