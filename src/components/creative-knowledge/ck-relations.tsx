"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, Loader2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { Sheet, SheetContent } from "@/components/ui/overlays";
import { CK_RELATION_LABEL, CK_RELATION_TYPES, ckCategoryLabel, type CkRelationType } from "@/lib/creative-knowledge";
import { cn } from "@/lib/utils";
import { addCkRelationAction, createAndRelateCkAction, pickCreativeKnowledgeAction, removeCkRelationAction } from "@/server/actions/creative-knowledge";

/** 関係の種類の説明（選ぶときに表示） */
const TYPE_HINT: Record<CkRelationType, string> = {
  related: "なんとなく関係がある",
  parent: "相手の方が広い概念（例：伏線 → 伏線回収）",
  child: "相手の方が具体的（例：伏線回収 → 伏線）",
  similar: "似ていて比べたい",
  opposite: "対になる・反対の考え方",
  prerequisite: "相手を理解・用意しておく必要がある",
  combination: "一緒に使うと効果的",
};

export function AddCkRelationButton({ knowledgeId, title }: { knowledgeId: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CkRelationType>("related");
  const [q, setQ] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<{ id: string; title: string; category: string }[] | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => pickCreativeKnowledgeAction(q, knowledgeId).then(setItems), 250);
    return () => clearTimeout(t);
  }, [q, open, knowledgeId]);

  const done = (msg: string) => {
    toast.success(msg);
    setOpen(false);
    setQ("");
    setNote("");
    router.refresh();
  };
  const exact = items?.some((i) => i.title === q.trim());

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Link2 /> つなげる
      </Button>
      <Sheet open={open} onOpenChange={setOpen} repositionInputs={false}>
        <SheetContent title="関連知識をつなげる" description={`「${title}」から見て、相手はどんな知識ですか？`}>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="関係の種類">
              {CK_RELATION_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={type === t}
                  onClick={() => setType(t)}
                  className={cn("min-h-9 rounded-full border px-3 text-sm", type === t ? "border-primary bg-primary/10 font-medium text-primary" : "bg-card hover:bg-accent")}
                >
                  {CK_RELATION_LABEL[t]}
                </button>
              ))}
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">{TYPE_HINT[type]}</p>
            <Field label="ひとことメモ（任意）" htmlFor="ckr-note">
              <Input id="ckr-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={100} placeholder="例：共通の敵がきっかけで味方になる" />
            </Field>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="創作知識を検索" className="pl-9" aria-label="創作知識を検索" />
            </div>
            {items === null ? (
              <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> 読み込み中…
              </p>
            ) : (
              <ul className="max-h-[40dvh] divide-y overflow-y-auto">
                {items.map((it) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const res = await addCkRelationAction({ fromId: knowledgeId, toId: it.id, type, note });
                          if (!res.ok) return void toast.error(res.error);
                          done(`「${it.title}」とつなげました`);
                        })
                      }
                      className="flex min-h-12 w-full items-center gap-2 py-2 text-left hover:bg-accent/40"
                    >
                      <span className="flex-1 font-medium">🧠 {it.title}</span>
                      <span className="text-xs text-muted-foreground">{ckCategoryLabel(it.category)}</span>
                    </button>
                  </li>
                ))}
                {!items.length && !q.trim() ? <li className="py-3 text-sm text-muted-foreground">ほかの創作知識がまだありません</li> : null}
              </ul>
            )}
            {q.trim() && !exact ? (
              <Button
                variant="outline"
                className="h-auto min-h-11 w-full justify-start py-2 text-left whitespace-normal"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await createAndRelateCkAction(knowledgeId, q.trim(), type);
                    if (!res.ok) return void toast.error(res.error);
                    done(`「${q.trim()}」を作ってつなげました（内容はあとで書けます）`);
                  })
                }
              >
                <Plus /> 「{q.trim()}」を新しく作ってつなげる
              </Button>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function RemoveCkRelationButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`「${title}」とのつながりを解除`}
      disabled={pending}
      className="relative z-10 shrink-0"
      onClick={() =>
        start(async () => {
          const res = await removeCkRelationAction(id);
          if (!res.ok) return void toast.error(res.error);
          toast.success("つながりを解除しました");
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
    </Button>
  );
}
