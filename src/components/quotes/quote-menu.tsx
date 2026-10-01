"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Heart, Loader2, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { deleteQuoteAction, toggleFavoriteAction } from "@/server/actions/quotes";
import { cn } from "@/lib/utils";

export function QuoteMenu({ id, isFavorite, text }: { id: string; isFavorite: boolean; text: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("コピーしました");
    } catch {
      toast.error("コピーできませんでした");
    }
  }
  async function share() {
    if (navigator.share) {
      await navigator.share({ text: `「${text}」` }).catch(() => undefined);
    } else copy();
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={isFavorite ? "お気に入りを解除" : "お気に入りに追加"}
        aria-pressed={isFavorite}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await toggleFavoriteAction(id);
            if (!res.ok) return void toast.error(res.error);
            router.refresh();
          })
        }
      >
        <Heart className={cn("size-5", isFavorite && "fill-rose-500 text-rose-500")} />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="その他の操作">
            <MoreHorizontal className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/quotes/${id}/edit`}>
              <Pencil /> 編集
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={copy}>
            <Copy /> テキストをコピー
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={share}>
            <Share2 /> 共有
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirm(true)} className="text-destructive">
            <Trash2 /> 削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <QuoteDeleteDialog id={id} open={confirm} onOpenChange={setConfirm} redirectTo="/quotes" />
    </>
  );
}

/** フレーズ削除の確認ダイアログ（一覧・詳細で共通） */
export function QuoteDeleteDialog({
  id,
  open,
  onOpenChange,
  redirectTo,
}: {
  id: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** 削除後に移動する先（詳細画面から削除する場合）。省略時はその場で再表示 */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="このフレーズを削除しますか？" description="元画像も削除されます。この操作は取り消せません。">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await deleteQuoteAction(id);
                if (!res.ok) return void toast.error(res.error);
                toast.success("フレーズを削除しました");
                onOpenChange(false);
                if (redirectTo) router.replace(redirectTo);
                router.refresh();
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            削除する
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** フレーズ一覧のカード右上のメニュー（編集・削除） */
export function QuoteCardMenu({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="フレーズの操作" className="text-muted-foreground">
            <MoreHorizontal className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/quotes/${id}/edit`}>
              <Pencil /> 編集
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirm(true)} className="text-destructive">
            <Trash2 /> 削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <QuoteDeleteDialog id={id} open={confirm} onOpenChange={setConfirm} />
    </>
  );
}

/** フレーズ詳細画面の下部に置く削除ボタン */
export function DeleteQuoteButton({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Button variant="outline" className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirm(true)}>
        <Trash2 /> このフレーズを削除
      </Button>
      <QuoteDeleteDialog id={id} open={confirm} onOpenChange={setConfirm} redirectTo="/quotes" />
    </>
  );
}
