"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/form-controls";
import { LINK_TARGET_LABEL, REFERENCE_PURPOSES, type LinkTargetKind } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { createProjectAction, listCreativeTargetsAction } from "@/server/actions/creative";
import type { CreativeTargets } from "@/server/services/creative";

export interface TargetValue {
  target: { kind: LinkTargetKind; id: string };
  purpose: string;
}

const KINDS: Exclude<LinkTargetKind, "note">[] = ["project", "character", "world", "plot", "chapter", "scene"];

/** 作品 → 紐付け先（作品全体・人物・世界観・プロット・章・シーン）→ 用途 を選ぶ */
export function TargetPicker({
  onChange,
  fixedProjectId,
  defaultKind = "project",
}: {
  onChange: (v: TargetValue | null) => void;
  /** 作品の画面から開いた場合はその作品に固定 */
  fixedProjectId?: string;
  defaultKind?: Exclude<LinkTargetKind, "note">;
}) {
  const [targets, setTargets] = useState<CreativeTargets | null>(null);
  const [projectId, setProjectId] = useState(fixedProjectId ?? "");
  const [kind, setKind] = useState<Exclude<LinkTargetKind, "note">>(defaultKind);
  const [itemId, setItemId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [pending, start] = useTransition();

  const load = (selectId?: string) =>
    listCreativeTargetsAction().then((t) => {
      setTargets(t);
      if (selectId) setProjectId(selectId);
      else if (!fixedProjectId && t.length) setProjectId((cur) => cur || t[0].id);
    });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const project = targets?.find((p) => p.id === projectId);
  const items = useMemo(() => {
    if (!project) return [];
    switch (kind) {
      case "character":
        return project.characters.map((c) => ({ id: c.id, label: c.role ? `${c.name}（${c.role}）` : c.name }));
      case "world":
        return project.worldSettings.map((w) => ({ id: w.id, label: `[${w.category}] ${w.title}` }));
      case "plot":
        return project.plots.map((p) => ({ id: p.id, label: p.title }));
      case "chapter":
        return project.chapters.map((c) => ({ id: c.id, label: c.title }));
      case "scene":
        return project.chapters.flatMap((c) => c.scenes.map((s) => ({ id: s.id, label: `${c.title} ／ ${s.title}` })));
      default:
        return [];
    }
  }, [project, kind]);

  // 親に選択内容を伝える
  const selectedItem = kind === "project" ? projectId : items.some((i) => i.id === itemId) ? itemId : items[0]?.id ?? "";
  useEffect(() => {
    if (!projectId || !selectedItem) onChange(null);
    else onChange({ target: { kind, id: selectedItem }, purpose });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, kind, selectedItem, purpose]);

  if (!targets) return <Loader2 className="mx-auto my-4 size-6 animate-spin text-muted-foreground" />;

  if (!targets.length) {
    return (
      <div className="space-y-3 rounded-xl border border-dashed p-4">
        <p className="text-sm text-muted-foreground">まだ小説プロジェクトがありません。作品名を入れて作成しましょう。</p>
        <div className="flex gap-2">
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="作品タイトル" aria-label="新しい作品のタイトル" maxLength={120} />
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            disabled={pending || !newTitle.trim()}
            onClick={() =>
              start(async () => {
                const res = await createProjectAction({ title: newTitle });
                if (!res.ok) return void toast.error(res.error);
                await load(res.data.id);
                setNewTitle("");
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : <Plus />} 作成
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!fixedProjectId ? (
        <Field label="作品" htmlFor="tp-project">
          <NativeSelect id="tp-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {targets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : null}
      <div className="space-y-2">
        <p className="text-sm font-medium">どこに使いますか？</p>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="紐付け先">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k);
                setItemId("");
              }}
              className={cn("h-10 rounded-lg border text-sm", kind === k ? "border-primary bg-primary/10 font-semibold text-primary" : "bg-card hover:bg-accent")}
            >
              {LINK_TARGET_LABEL[k]}
            </button>
          ))}
        </div>
      </div>
      {kind !== "project" ? (
        items.length ? (
          <Field label={LINK_TARGET_LABEL[kind]} htmlFor="tp-item">
            <NativeSelect id="tp-item" value={selectedItem} onChange={(e) => setItemId(e.target.value)}>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : (
          <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
            この作品にはまだ{LINK_TARGET_LABEL[kind]}がありません。作品の画面から追加するか、「作品全体」を選んでください。
          </p>
        )
      ) : null}
      <Field label="用途（任意）" htmlFor="tp-purpose" hint="何のための資料かを残すと、あとで探しやすくなります">
        <Input id="tp-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="人物造形・会話・情景描写 など" maxLength={60} />
        <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pt-1">
          {REFERENCE_PURPOSES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPurpose(p)}
              className={cn("h-8 shrink-0 rounded-full border px-3 text-xs", purpose === p ? "border-primary bg-primary/10 text-primary" : "bg-card text-muted-foreground")}
            >
              {p}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}
