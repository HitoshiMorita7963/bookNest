"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { toUserError, type ActionResult } from "@/lib/errors";
import type { ChapterInput, CharacterInput, CreativeNoteInput, LinkInput, PlotInput, ProjectInput, SceneInput, WorldInput } from "@/lib/validators";
import * as creative from "@/server/services/creative";
import * as novels from "@/server/services/novels";

function done<T>(data: T): ActionResult<T> {
  revalidatePath("/", "layout");
  return { ok: true, data };
}
async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return done(await fn());
  } catch (e) {
    return toUserError(e);
  }
}

/* ---------------- 創作メモ ---------------- */

export async function createCreativeNoteAction(input: CreativeNoteInput, link?: { source?: LinkInput["source"]; target?: LinkInput["target"]; purpose?: string | null }) {
  return run(async () => {
    const note = await creative.createCreativeNote(prisma, input);
    // 元になった資料（本・フレーズ・知識）とメモをつなぐ
    if (link?.source) await creative.createLink(prisma, { source: link.source, target: { kind: "note", id: note.id }, purpose: link.purpose ?? null });
    // そのまま作品（人物・シーンなど）に追加する
    if (link?.target) await creative.createLink(prisma, { source: { kind: "note", id: note.id }, target: link.target, purpose: link.purpose ?? null });
    return { id: note.id };
  });
}
export async function updateCreativeNoteAction(id: string, input: CreativeNoteInput) {
  return run(async () => {
    await creative.updateCreativeNote(prisma, id, input);
    return { id };
  });
}
export async function setCreativeNoteStatusAction(id: string, status: string) {
  return run(async () => void (await creative.setCreativeNoteStatus(prisma, id, status)));
}
export async function deleteCreativeNoteAction(id: string) {
  return run(() => creative.deleteCreativeNote(prisma, id));
}
export async function pickCreativeNotesAction(q: string) {
  return creative.pickCreativeNotes(prisma, q.slice(0, 100));
}

/* ---------------- 紐付け ---------------- */

export async function createLinkAction(input: LinkInput) {
  return run(async () => void (await creative.createLink(prisma, input)));
}
export async function updateLinkPurposeAction(id: string, purpose: string | null) {
  return run(async () => void (await creative.updateLinkPurpose(prisma, id, purpose)));
}
export async function deleteLinkAction(id: string) {
  return run(() => creative.deleteLink(prisma, id));
}
export async function listCreativeTargetsAction() {
  return creative.listCreativeTargets(prisma);
}

/* ---------------- 作品 ---------------- */

export async function createProjectAction(input: ProjectInput) {
  return run(async () => ({ id: (await novels.createProject(prisma, input)).id }));
}
export async function updateProjectAction(id: string, input: ProjectInput) {
  return run(async () => void (await novels.updateProject(prisma, id, input)));
}
export async function deleteProjectAction(id: string) {
  return run(() => novels.deleteProject(prisma, id));
}

/* ---------------- 作品内の要素 ---------------- */

export async function saveCharacterAction(projectId: string, id: string | null, input: CharacterInput) {
  return run(async () => ({ id: (id ? await novels.updateCharacter(prisma, id, input) : await novels.createCharacter(prisma, projectId, input)).id }));
}
export async function deleteCharacterAction(id: string) {
  return run(() => novels.deleteCharacter(prisma, id));
}
export async function createRelationshipAction(projectId: string, input: { fromId: string; toId: string; label: string; notes?: string }) {
  return run(async () => void (await novels.createRelationship(prisma, projectId, input)));
}
export async function deleteRelationshipAction(id: string) {
  return run(() => novels.deleteRelationship(prisma, id));
}
export async function saveWorldAction(projectId: string, id: string | null, input: WorldInput) {
  return run(async () => ({ id: (id ? await novels.updateWorld(prisma, id, input) : await novels.createWorld(prisma, projectId, input)).id }));
}
export async function deleteWorldAction(id: string) {
  return run(() => novels.deleteWorld(prisma, id));
}
export async function savePlotAction(projectId: string, id: string | null, input: PlotInput) {
  return run(async () => ({ id: (id ? await novels.updatePlot(prisma, id, input) : await novels.createPlot(prisma, projectId, input)).id }));
}
export async function deletePlotAction(id: string) {
  return run(() => novels.deletePlot(prisma, id));
}
export async function saveChapterAction(projectId: string, id: string | null, input: ChapterInput) {
  return run(async () => ({ id: (id ? await novels.updateChapter(prisma, id, input) : await novels.createChapter(prisma, projectId, input)).id }));
}
export async function deleteChapterAction(id: string) {
  return run(() => novels.deleteChapter(prisma, id));
}
export async function saveSceneAction(chapterId: string, id: string | null, input: SceneInput) {
  return run(async () => ({ id: (id ? await novels.updateScene(prisma, id, input) : await novels.createScene(prisma, chapterId, input)).id }));
}
export async function deleteSceneAction(id: string) {
  return run(() => novels.deleteScene(prisma, id));
}
export async function moveItemAction(kind: "character" | "plot" | "chapter" | "scene", id: string, direction: -1 | 1) {
  return run(() => novels.moveItem(prisma, kind, id, direction === -1 ? -1 : 1));
}
