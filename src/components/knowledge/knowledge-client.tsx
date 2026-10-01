"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, Loader2, MoreHorizontal, Pencil, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Sheet, SheetContent } from "@/components/ui/overlays";
import { deleteKnowledgeAction, linkKnowledgeAction, pickKnowledgeAction, unlinkKnowledgeAction } from "@/server/actions/knowledge";

export function KnowledgeMenu({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [link, setLink] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="その他の操作">
            <MoreHorizontal className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/knowledge/${id}/edit`}>
              <Pencil /> 編集
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setLink(true)}>
            <Link2 /> 他の知識とつなげる
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirm(true)} className="text-destructive">
            <Trash2 /> 削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <LinkKnowledgeSheet open={link} onOpenChange={setLink} fromId={id} />
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent title={`「${title}」を削除しますか？`} description="関連する本・フレーズは削除されません。">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteKnowledgeAction(id);
                  if (!res.ok) return void toast.error(res.error);
                  router.replace("/knowledge");
                  router.refresh();
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <Trash2 />} 削除する
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function LinkKnowledgeSheet({ open, onOpenChange, fromId }: { open: boolean; onOpenChange: (o: boolean) => void; fromId: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [label, setLabel] = useState("");
  const [items, setItems] = useState<{ id: string; title: string; category: string | null }[]>([]);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => pickKnowledgeAction(q).then(setItems), 250);
    return () => clearTimeout(t);
  }, [q, open]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <SheetContent title="知識をつなげる" description="知識マップに矢印でつながりが表示されます">
        <div className="space-y-3">
          <Field label="つながりの説明（任意）" htmlFor="l-label">
            <Input id="l-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="例：原因と結果、具体例" maxLength={60} />
          </Field>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="知識を検索" className="pl-9" aria-label="知識を検索" />
          </div>
          <ul className="divide-y">
            {items
              .filter((i) => i.id !== fromId)
              .map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await linkKnowledgeAction(fromId, it.id, label);
                        if (!res.ok) return void toast.error(res.error);
                        toast.success(`「${it.title}」とつなげました`);
                        onOpenChange(false);
                        router.refresh();
                      })
                    }
                    className="flex min-h-12 w-full items-center gap-2 py-2 text-left"
                  >
                    <span className="flex-1 font-medium">🧠 {it.title}</span>
                    {it.category ? <span className="text-xs text-muted-foreground">{it.category}</span> : null}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function UnlinkKnowledgeButton({ a, b }: { a: string; b: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="つながりを解除"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await unlinkKnowledgeAction(a, b);
          if (!res.ok) return void toast.error(res.error);
          router.refresh();
        })
      }
    >
      <X className="size-4" />
    </Button>
  );
}
