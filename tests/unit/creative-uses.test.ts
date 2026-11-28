import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./helpers";
import { createQuote } from "@/server/services/quotes";
import { createProject, createCharacter } from "@/server/services/novels";
import { createCreativeNote, creativeUsageOf } from "@/server/services/creative";
import { createCreativeKnowledge } from "@/server/services/creative-knowledge";
import { ckUsageOfSource } from "@/server/services/creative-knowledge-references";
import { applyCreativeUses } from "@/server/services/creative-uses";

beforeEach(resetDb);

describe("保存前に予約した「創作に使う」", () => {
  it("作品・創作メモ・創作知識へのつながりを、保存したフレーズを元資料として作る", async () => {
    const project = await createProject(db, { title: "灯台の物語" });
    const hal = await createCharacter(db, project.id, { name: "ハル" });
    const existingNote = await createCreativeNote(db, { title: "灯りのモチーフ" });
    const ck = await createCreativeKnowledge(db, { title: "孤独な守り手", category: "TROPE" });
    const quote = await createQuote(db, { text: "人は誰でも孤独な灯台だ" });

    const res = await applyCreativeUses(db, { kind: "quote", id: quote.id }, [
      { type: "link", target: { kind: "character", id: hal.id }, purpose: "人物造形" },
      { type: "link", target: { kind: "note", id: existingNote.id }, purpose: null },
      { type: "note", note: { title: "灯台守の独白", content: "", category: "DIALOGUE" }, target: { kind: "project", id: project.id }, purpose: null },
      { type: "ck-new", ck: { title: "灯台という象徴", category: "MOTIF", subCategory: null }, comment: "孤独の比喩", location: null },
      { type: "ck-ref", knowledgeId: ck.id, comment: null, location: "p.10" },
    ]);
    expect(res.failed).toBe(0);
    expect(res.noteIds).toHaveLength(2);

    const usage = await creativeUsageOf(db, { kind: "quote", id: quote.id });
    const labels = usage.projects.flatMap((p) => p.items.map((i) => i.label));
    expect(labels).toContain("ハル");
    expect(usage.notes.map((n) => n.title).sort()).toEqual(["灯りのモチーフ", "灯台守の独白"].sort());
    const cks = await ckUsageOfSource(db, { kind: "quote", id: quote.id });
    expect(cks.map((k) => k.title).sort()).toEqual(["孤独な守り手", "灯台という象徴"].sort());
  });

  it("1つ失敗しても残りは反映し、失敗した数を返す", async () => {
    const quote = await createQuote(db, { text: "x" });
    const ck = await createCreativeKnowledge(db, { title: "伏線", category: "TROPE" });
    const res = await applyCreativeUses(db, { kind: "quote", id: quote.id }, [
      { type: "link", target: { kind: "character", id: "nope" }, purpose: null },
      { type: "ck-ref", knowledgeId: ck.id, comment: null, location: null },
    ]);
    expect(res.failed).toBe(1);
    expect(await ckUsageOfSource(db, { kind: "quote", id: quote.id })).toHaveLength(1);
  });
});
