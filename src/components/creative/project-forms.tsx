"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteEntityButton, EntityForm, EntitySheetButton, type FieldDef } from "./entity-form";
import {
  CHARACTER_ROLE_SUGGESTIONS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  SCENE_STATUSES,
  SCENE_STATUS_LABEL,
  WORLD_CATEGORIES,
} from "@/lib/constants";
import {
  createProjectAction,
  createRelationshipAction,
  deleteChapterAction,
  deleteCharacterAction,
  deletePlotAction,
  deleteProjectAction,
  deleteRelationshipAction,
  deleteSceneAction,
  deleteWorldAction,
  moveItemAction,
  saveChapterAction,
  saveCharacterAction,
  savePlotAction,
  saveSceneAction,
  saveWorldAction,
  updateProjectAction,
} from "@/server/actions/creative";

type Values = Record<string, string>;
const idOf = (d: unknown) => (d && typeof d === "object" && "id" in d ? String((d as { id: string }).id) : null);

/* ---------------- 作品 ---------------- */

const PROJECT_FIELDS: FieldDef[] = [
  { name: "title", label: "作品タイトル", required: true, placeholder: "仮タイトルでOK" },
  { name: "logline", label: "一行あらすじ", placeholder: "誰が、何をして、どうなる物語か" },
  { name: "status", label: "ステータス", type: "select", options: PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABEL[s] })) },
  { name: "genre", label: "ジャンル", placeholder: "純文学・ミステリ・SF など" },
  { name: "theme", label: "テーマ", placeholder: "孤独と再生 など" },
  { name: "synopsis", label: "作品概要", type: "textarea", rows: 8 },
];

export function ProjectForm({ id, initial }: { id?: string; initial?: Values }) {
  const router = useRouter();
  return (
    <EntityForm
      fields={PROJECT_FIELDS}
      initial={initial}
      submitLabel={id ? "保存する" : "作品を作る"}
      onSubmit={(v) => (id ? updateProjectAction(id, v as never) : createProjectAction(v as never))}
      onDone={(data) => {
        toast.success(id ? "作品を更新しました" : "✍️ 作品を作成しました");
        router.push(`/creative/projects/${id ?? idOf(data)}`);
        router.refresh();
      }}
    />
  );
}

export function DeleteProjectButton({ id, title }: { id: string; title: string }) {
  return (
    <DeleteEntityButton
      variant="full"
      label={`作品「${title}」`}
      description="人物・世界観・プロット・章・シーン・AI編集者の相談履歴も削除されます。本・フレーズ・知識・創作メモは削除されません。"
      onDelete={() => deleteProjectAction(id)}
      redirectTo="/creative"
    />
  );
}

/* ---------------- 人物 ---------------- */

const CHARACTER_FIELDS: FieldDef[] = [
  { name: "name", label: "名前", required: true },
  { name: "role", label: "役割", suggestions: CHARACTER_ROLE_SUGGESTIONS, placeholder: "主人公・ヒロイン・ライバル など" },
  { name: "age", label: "年齢", placeholder: "17歳・30代 など" },
  { name: "personality", label: "性格", type: "textarea" },
  { name: "goal", label: "目的", type: "textarea", rows: 2 },
  { name: "conflict", label: "葛藤", type: "textarea", rows: 2 },
  { name: "appearance", label: "外見", type: "textarea", advanced: true },
  { name: "background", label: "過去", type: "textarea", rows: 4, advanced: true },
  { name: "speechStyle", label: "話し方", type: "textarea", rows: 2, advanced: true },
  { name: "notes", label: "メモ", type: "textarea", rows: 4, advanced: true },
];

export function CharacterSheetButton({ projectId, character }: { projectId: string; character?: Values & { id: string } }) {
  return (
    <EntitySheetButton
      title={character ? "人物を編集" : "人物を追加"}
      mode={character ? "edit" : "create"}
      buttonLabel="人物"
      fields={CHARACTER_FIELDS}
      initial={character}
      onSubmit={(v) => saveCharacterAction(projectId, character?.id ?? null, v as never)}
      successMessage={character ? "人物を更新しました" : "👤 人物を追加しました"}
    />
  );
}

export function RelationshipSheetButton({ projectId, characters }: { projectId: string; characters: { id: string; name: string }[] }) {
  if (characters.length < 2) return null;
  const options = characters.map((c) => ({ value: c.id, label: c.name }));
  return (
    <EntitySheetButton
      title="人物の関係を追加"
      buttonLabel="関係"
      fields={[
        { name: "fromId", label: "人物", type: "select", options },
        { name: "label", label: "関係", required: true, suggestions: ["恋愛", "ライバル", "幼馴染", "親子", "師弟", "友人", "敵対", "兄弟"], placeholder: "恋愛・ライバル・幼馴染 など" },
        { name: "toId", label: "相手", type: "select", options: [...options.slice(1), options[0]] },
        { name: "notes", label: "メモ", type: "textarea", rows: 2 },
      ]}
      onSubmit={(v) => createRelationshipAction(projectId, { fromId: v.fromId, toId: v.toId, label: v.label, notes: v.notes })}
      successMessage="関係を追加しました"
    />
  );
}

/* ---------------- 世界観 ---------------- */

const WORLD_FIELDS: FieldDef[] = [
  { name: "title", label: "項目名", required: true, placeholder: "港町エルム・魔法の仕組み など" },
  { name: "category", label: "カテゴリ", type: "select", options: WORLD_CATEGORIES.map((c) => ({ value: c, label: c })) },
  { name: "content", label: "内容", type: "textarea", rows: 8 },
];
export function WorldSheetButton({ projectId, world }: { projectId: string; world?: Values & { id: string } }) {
  return (
    <EntitySheetButton
      title={world ? "世界観を編集" : "世界観を追加"}
      mode={world ? "edit" : "create"}
      buttonLabel="世界観"
      fields={WORLD_FIELDS}
      initial={world}
      onSubmit={(v) => saveWorldAction(projectId, world?.id ?? null, v as never)}
      successMessage={world ? "世界観を更新しました" : "🌍 世界観を追加しました"}
    />
  );
}

/* ---------------- プロット ---------------- */

const STATUS_OPTIONS = SCENE_STATUSES.map((s) => ({ value: s, label: SCENE_STATUS_LABEL[s] }));
const PLOT_FIELDS: FieldDef[] = [
  { name: "title", label: "タイトル", required: true, placeholder: "起・承・転・結 / 出会い など" },
  { name: "summary", label: "概要", type: "textarea", rows: 5 },
  { name: "status", label: "状態", type: "select", options: STATUS_OPTIONS },
  { name: "notes", label: "メモ", type: "textarea", rows: 3, advanced: true },
];
export function PlotSheetButton({ projectId, plot }: { projectId: string; plot?: Values & { id: string } }) {
  return (
    <EntitySheetButton
      title={plot ? "プロットを編集" : "プロットを追加"}
      mode={plot ? "edit" : "create"}
      buttonLabel="プロット"
      fields={PLOT_FIELDS}
      initial={plot}
      onSubmit={(v) => savePlotAction(projectId, plot?.id ?? null, v as never)}
      successMessage={plot ? "プロットを更新しました" : "📋 プロットを追加しました"}
    />
  );
}

/* ---------------- 章・シーン ---------------- */

const CHAPTER_FIELDS: FieldDef[] = [
  { name: "title", label: "章タイトル", required: true, placeholder: "第1章　出会い" },
  { name: "summary", label: "概要", type: "textarea", rows: 4 },
];
export function ChapterSheetButton({ projectId, chapter }: { projectId: string; chapter?: Values & { id: string } }) {
  return (
    <EntitySheetButton
      title={chapter ? "章を編集" : "章を追加"}
      mode={chapter ? "edit" : "create"}
      buttonLabel="章"
      fields={CHAPTER_FIELDS}
      initial={chapter}
      onSubmit={(v) => saveChapterAction(projectId, chapter?.id ?? null, v as never)}
      successMessage={chapter ? "章を更新しました" : "📖 章を追加しました"}
    />
  );
}

const SCENE_FIELDS: FieldDef[] = [
  { name: "title", label: "シーン名", required: true, placeholder: "灯台での再会 など" },
  { name: "status", label: "状態", type: "select", options: STATUS_OPTIONS },
  { name: "summary", label: "概要", type: "textarea", rows: 4 },
  { name: "content", label: "下書き（セリフ・描写など）", type: "textarea", rows: 10, advanced: true },
];
export function SceneSheetButton({ chapterId, scene, projectId }: { chapterId: string; scene?: Values & { id: string }; projectId?: string }) {
  return (
    <EntitySheetButton
      title={scene ? "シーンを編集" : "シーンを追加"}
      mode={scene ? "edit" : "create"}
      buttonLabel="シーン"
      fields={SCENE_FIELDS}
      initial={scene}
      onSubmit={(v) => saveSceneAction(chapterId, scene?.id ?? null, v as never)}
      successMessage={scene ? "シーンを更新しました" : "🎬 シーンを追加しました"}
      navigateTo={!scene && projectId ? (d) => `/creative/projects/${projectId}/scenes/${idOf(d)}` : undefined}
    />
  );
}

/* ---------------- 削除・並び替え ---------------- */

const DELETE_ACTION = {
  character: deleteCharacterAction,
  world: deleteWorldAction,
  plot: deletePlotAction,
  chapter: deleteChapterAction,
  scene: deleteSceneAction,
  relationship: deleteRelationshipAction,
} as const;

export function DeleteItemButton({ kind, id, label, redirectTo, variant }: { kind: keyof typeof DELETE_ACTION; id: string; label: string; redirectTo?: string; variant?: "icon" | "full" }) {
  return <DeleteEntityButton label={label} onDelete={() => DELETE_ACTION[kind](id)} redirectTo={redirectTo} variant={variant} />;
}

export function MoveButtons({ kind, id, first, last }: { kind: "character" | "plot" | "chapter" | "scene"; id: string; first: boolean; last: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const move = (d: -1 | 1) =>
    start(async () => {
      const res = await moveItemAction(kind, id, d);
      if (!res.ok) return void toast.error(res.error);
      router.refresh();
    });
  return (
    <div className="flex shrink-0">
      <Button variant="ghost" size="icon-sm" aria-label="上へ" disabled={first || pending} onClick={() => move(-1)}>
        <ArrowUp />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="下へ" disabled={last || pending} onClick={() => move(1)}>
        <ArrowDown />
      </Button>
    </div>
  );
}
