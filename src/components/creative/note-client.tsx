"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FolderPlus, Loader2, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Sheet, SheetContent } from "@/components/ui/overlays";
import { TargetPicker, type TargetValue } from "./target-picker";
import { createLinkAction, deleteCreativeNoteAction, deleteLinkAction, setCreativeNoteStatusAction } from "@/server/actions/creative";
import { NOTE_STATUSES, NOTE_STATUS_LABEL, type LinkSourceKind, type LinkTargetKind } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** 資料・作品を「作品に追加」するシート（創作メモ以外にも使える） */
export function AddToProjectButton({
  source,
  label = "作品に追加",
  fixedProjectId,
  defaultKind,
  variant = "default",
}: {
  source: { kind: LinkSourceKind; id: string };
  label?: string;
  fixedProjectId?: string;
  defaultKind?: Exclude<LinkTargetKind, "note">;
  variant?: "default" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<TargetValue | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)}>
        <FolderPlus /> {label}
      </Button>
      <Sheet open={open} onOpenChange={setOpen} repositionInputs={false}>
        <SheetContent title={label} description="作品・人物・世界観・プロット・章・シーンに関連付けます">
          {open ? (
            <div className="space-y-4">
              <TargetPicker onChange={setTarget} fixedProjectId={fixedProjectId} defaultKind={defaultKind} />
              <Button
                size="lg"
                className="w-full"
                disabled={pending || !target}
                onClick={() =>
                  start(async () => {
                    if (!target) return;
                    const res = await createLinkAction({ source, target: target.target, purpose: target.purpose || null });
                    if (!res.ok) return void toast.error(res.error);
                    toast.success("作品に追加しました");
                    setOpen(false);
                    router.refresh();
                  })
                }
              >
                {pending ? <Loader2 className="animate-spin" /> : <FolderPlus />} 追加する
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

export function NoteStatusSwitcher({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="ステータス">
      {NOTE_STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={status === s}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await setCreativeNoteStatusAction(id, s);
              if (!res.ok) return void toast.error(res.error);
              router.refresh();
            })
          }
          className={cn("h-9 rounded-lg text-xs font-medium", status === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
        >
          {NOTE_STATUS_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

export function NoteMenu({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="創作メモの操作">
            <MoreHorizontal className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/creative/notes/${id}/edit`}>
              <Pencil /> 編集
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirm(true)} className="text-destructive">
            <Trash2 /> 削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent title={`「${title}」を削除しますか？`} description="作品との関連付けも削除されます。元の本・フレーズ・知識は削除されません。">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteCreativeNoteAction(id);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success("創作メモを削除しました");
                  router.replace("/creative/notes");
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

/** 紐付けの一覧（タップで元データへ、×で解除） */
export function LinkList({
  items,
  empty,
}: {
  items: { id: string; icon: string; label: string; sub?: string | null; href: string; purpose?: string | null }[];
  empty?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!items.length) return empty ? <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">{empty}</p> : null;
  return (
    <ul className="space-y-1.5">
      {items.map((it) => (
        <li key={it.id} className="flex items-center gap-1 rounded-xl border bg-card pl-3">
          <Link href={it.href} className="min-w-0 flex-1 py-2.5">
            <p className="line-clamp-2 text-sm">
              <span aria-hidden className="mr-1">
                {it.icon}
              </span>
              {it.label}
            </p>
            {it.sub || it.purpose ? (
              <p className="text-xs text-muted-foreground">
                {it.sub}
                {it.sub && it.purpose ? " ・ " : ""}
                {it.purpose ? `用途：${it.purpose}` : ""}
              </p>
            ) : null}
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="関連付けを解除"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await deleteLinkAction(it.id);
                if (!res.ok) return void toast.error(res.error);
                router.refresh();
              })
            }
          >
            <X className="size-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
