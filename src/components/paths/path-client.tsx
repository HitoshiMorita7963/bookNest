"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Sheet, SheetContent } from "@/components/ui/overlays";
import { BookPickerSheet } from "@/components/books/book-picker";
import { addBookToPathAction, createPathAction, deletePathAction, moveBookInPathAction, removeBookFromPathAction, updatePathAction } from "@/server/actions/paths";

export function PathFormSheet({ open, onOpenChange, path }: { open: boolean; onOpenChange: (o: boolean) => void; path?: { id: string; title: string; description: string | null } }) {
  const router = useRouter();
  const [title, setTitle] = useState(path?.title ?? "");
  const [desc, setDesc] = useState(path?.description ?? "");
  const [pending, start] = useTransition();
  return (
    <Sheet open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <SheetContent title={path ? "読書ルートを編集" : "新しい読書ルート"} description="「この順番で読む」というコースを作れます">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = path ? await updatePathAction(path.id, { title, description: desc }) : await createPathAction({ title, description: desc });
              if (!res.ok) return void toast.error(res.error);
              onOpenChange(false);
              if (!path && res.data && typeof res.data === "object" && "id" in res.data) router.push(`/paths/${(res.data as { id: string }).id}`);
              else router.refresh();
            });
          }}
        >
          <Field label="タイトル" htmlFor="p-title">
            <Input id="p-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：政治・経済入門" required maxLength={100} />
          </Field>
          <Field label="説明（任意）" htmlFor="p-desc">
            <Textarea id="p-desc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={2000} />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={pending || !title.trim()}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {path ? "保存する" : "作成する"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function NewPathButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> ルートを作る
      </Button>
      <PathFormSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

export function PathMenu({ path, bookIds }: { path: { id: string; title: string; description: string | null }; bookIds: string[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [pick, setPick] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setPick(true)}>
        <Plus /> 本を追加
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="読書ルートの操作">
            <MoreHorizontal className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEdit(true)}>
            <Pencil /> 編集
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirm(true)} className="text-destructive">
            <Trash2 /> 削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <PathFormSheet open={edit} onOpenChange={setEdit} path={path} />
      <BookPickerSheet
        open={pick}
        onOpenChange={setPick}
        title="ルートに本を追加"
        excludeIds={bookIds}
        onPick={(b) =>
          start(async () => {
            const res = await addBookToPathAction(path.id, b.id);
            if (!res.ok) return void toast.error(res.error);
            toast.success(`『${b.title}』を追加しました`);
            router.refresh();
          })
        }
      />
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent title={`「${path.title}」を削除しますか？`} description="ルートだけが削除され、本は削除されません。">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deletePathAction(path.id);
                  if (!res.ok) return void toast.error(res.error);
                  router.replace("/paths");
                  router.refresh();
                })
              }
            >
              削除する
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PathItemControls({ pathId, bookId, first, last }: { pathId: string; bookId: string; first: boolean; last: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? "失敗しました");
      router.refresh();
    });
  return (
    <div className="flex shrink-0 items-center">
      <Button variant="ghost" size="icon-sm" aria-label="上へ" disabled={first || pending} onClick={() => run(() => moveBookInPathAction(pathId, bookId, -1))}>
        <ArrowUp />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="下へ" disabled={last || pending} onClick={() => run(() => moveBookInPathAction(pathId, bookId, 1))}>
        <ArrowDown />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="ルートから外す" disabled={pending} onClick={() => run(() => removeBookFromPathAction(pathId, bookId))}>
        <X />
      </Button>
    </div>
  );
}
