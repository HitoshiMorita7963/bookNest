"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Save, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";
import { setCkMyNoteAction, toggleCkFavoriteAction } from "@/server/actions/creative-knowledge";

/** お気に入りの切り替え（詳細画面の右上） */
export function CkFavoriteButton({ id, initial }: { id: string; initial: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={on ? "お気に入りから外す" : "お気に入りに追加"}
      aria-pressed={on}
      title={on ? "お気に入りから外す" : "今後の創作で使いたい知識としてお気に入りに追加"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setOn(!on);
          const res = await toggleCkFavoriteAction(id);
          if (!res.ok) {
            setOn(on);
            return void toast.error(res.error);
          }
          toast.success(res.data.isFavorite ? "★ お気に入りに追加しました" : "お気に入りから外しました");
          router.refresh();
        })
      }
    >
      <Star className={cn("size-5", on && "fill-amber-400 text-amber-500")} />
    </Button>
  );
}

/** 自分のメモ（一般的な知識とは分けて保存） */
export function CkMyNote({ id, initial }: { id: string; initial: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initial);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await setCkMyNoteAction(id, text);
      if (!res.ok) return void toast.error(res.error);
      toast.success("自分のメモを保存しました");
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return initial ? (
      <div className="rounded-2xl border border-amber-300/60 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
        <p className="prose-note text-[15px] leading-relaxed">{initial}</p>
        <Button variant="ghost" size="sm" className="mt-2 -ml-2" onClick={() => setEditing(true)}>
          <Pencil /> 編集
        </Button>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full rounded-2xl border border-dashed p-4 text-left text-sm text-muted-foreground hover:bg-accent/40"
      >
        自分の作品でどう使いたいか、この知識についての自分の考えを書いておけます（一般的な説明とは別に保存されます）。
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <label htmlFor={`ck-mynote-${id}`} className="sr-only">
        自分のメモ
      </label>
      <Textarea
        id={`ck-mynote-${id}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        maxLength={10000}
        autoFocus
        placeholder="例：自分の小説では単純な改心ではなく、主人公と思想の対立を残したまま共闘させたい。"
      />
      <div className="flex gap-2">
        <Button onClick={save} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />} 保存
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setText(initial);
            setEditing(false);
          }}
        >
          キャンセル
        </Button>
      </div>
    </div>
  );
}
