"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/form-controls";
import { CategoryChips } from "./bits";
import { NOTE_STATUSES, NOTE_STATUS_LABEL, type CreativeCategory, type NoteStatus } from "@/lib/constants";
import { splitList } from "@/lib/utils";
import { createCreativeNoteAction, updateCreativeNoteAction } from "@/server/actions/creative";
import type { LinkInput } from "@/lib/validators";

export interface NoteFormValues {
  title: string;
  content: string;
  category: CreativeCategory;
  status: NoteStatus;
  tags: string;
}

/**
 * 創作メモの入力フォーム。
 * 新規作成時はタイトル・本文・カテゴリだけ（数秒で保存できるように）。詳細は保存後に編集。
 */
export function NoteForm({
  noteId,
  initial,
  link,
  onSaved,
  submitLabel,
}: {
  noteId?: string;
  initial?: Partial<NoteFormValues>;
  /** 元資料・作品への紐付け（「創作に使う」から作る場合） */
  link?: { source?: LinkInput["source"]; target?: LinkInput["target"]; purpose?: string | null };
  onSaved?: (id: string) => void;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [v, setV] = useState<NoteFormValues>({ title: "", content: "", category: "OTHER", status: "IDEA", tags: "", ...initial });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const editing = !!noteId;

  function save() {
    setError(null);
    if (!v.title.trim() && !v.content.trim()) {
      setError("タイトルか本文を入力してください");
      return;
    }
    start(async () => {
      const payload = { title: v.title, content: v.content, category: v.category, status: v.status, tags: splitList(v.tags) };
      const res = editing ? await updateCreativeNoteAction(noteId!, payload) : await createCreativeNoteAction(payload, link);
      if (!res.ok) return void toast.error(res.error);
      toast.success(editing ? "創作メモを更新しました" : "💡 創作メモを保存しました");
      if (onSaved) onSaved(res.data.id);
      else {
        router.push(`/creative/notes/${res.data.id}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <Field label="タイトル" htmlFor="cn-title" hint={editing ? undefined : "空欄なら本文の1行目がタイトルになります"}>
        <Input id="cn-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={120} placeholder="例：灯台守の老人" aria-invalid={!!error} />
      </Field>
      <div className="space-y-2">
        <label htmlFor="cn-content" className="text-sm font-medium">
          本文
        </label>
        <Textarea id="cn-content" value={v.content} onChange={(e) => setV({ ...v, content: e.target.value })} rows={6} className="min-h-36" placeholder="思いついたことをそのまま書きましょう" />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">カテゴリ</p>
        <CategoryChips value={v.category} onChange={(c) => setV({ ...v, category: c })} />
      </div>
      {editing ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ステータス" htmlFor="cn-status">
            <NativeSelect id="cn-status" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as NoteStatus })}>
              {NOTE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {NOTE_STATUS_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="タグ" htmlFor="cn-tags" hint="「、」区切り">
            <Input id="cn-tags" value={v.tags} onChange={(e) => setV({ ...v, tags: e.target.value })} />
          </Field>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button size="lg" className="w-full" onClick={save} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Save />}
        {submitLabel ?? (editing ? "更新する" : "保存する")}
      </Button>
    </div>
  );
}
