"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/overlays";
import { deleteCreativeKnowledgeAction } from "@/server/actions/creative-knowledge";

/** 創作知識の詳細画面右上のメニュー（編集・削除） */
export function CkMenu({ id, title, isSample = false }: { id: string; title: string; isSample?: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="創作知識の操作">
            <MoreHorizontal className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/creative/knowledge/${id}/edit`}>
              <Pencil /> 編集
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirm(true)} className="text-destructive">
            <Trash2 /> 削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent title={`「${title}」を削除しますか？`} description={`関連知識・参考にした読書・作品への関連付けも削除されます。元の本・フレーズ・作品は削除されません。${isSample ? "サンプルの知識は、「基本の創作知識」を読み込み直しても戻りません。" : ""}`}>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteCreativeKnowledgeAction(id);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success("創作知識を削除しました");
                  router.replace("/creative/knowledge");
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
