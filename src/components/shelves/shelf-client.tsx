"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, X, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Sheet, SheetContent } from "@/components/ui/overlays";
import { addBookToShelfAction, createShelfAction, deleteShelfAction, removeBookFromShelfAction, updateShelfAction } from "@/server/actions/shelves";
import { BookPickerSheet } from "@/components/books/book-picker";

export function ShelfFormSheet({
  open,
  onOpenChange,
  shelf,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  shelf?: { id: string; name: string; description: string | null };
}) {
  const router = useRouter();
  const [name, setName] = useState(shelf?.name ?? "");
  const [desc, setDesc] = useState(shelf?.description ?? "");
  const [pending, start] = useTransition();
  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = shelf ? await updateShelfAction(shelf.id, { name, description: desc }) : await createShelfAction({ name, description: desc });
      if (!res.ok) return void toast.error(res.error);
      toast.success(shelf ? "本棚を更新しました" : `「${name}」を作成しました`);
      onOpenChange(false);
      if (!shelf && res.ok && res.data && typeof res.data === "object" && "id" in res.data) router.push(`/shelves/${(res.data as { id: string }).id}`);
      else router.refresh();
    });
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <SheetContent title={shelf ? "本棚を編集" : "新しい本棚"}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="名前" htmlFor="shelf-name">
            <Input id="shelf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例：人生ベスト、2026年ベスト" maxLength={60} required />
          </Field>
          <Field label="説明（任意）" htmlFor="shelf-desc">
            <Textarea id="shelf-desc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={500} />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={pending || !name.trim()}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {shelf ? "保存する" : "作成する"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function NewShelfButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> 本棚を作る
      </Button>
      <ShelfFormSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

export function ShelfMenu({ shelf, bookIds }: { shelf: { id: string; name: string; description: string | null }; bookIds: string[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pick, setPick] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setPick(true)}>
        <Plus /> 本を追加
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="本棚の操作">
            <MoreHorizontal className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEdit(true)}>
            <Pencil /> 名前・説明を編集
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirm(true)} className="text-destructive">
            <Trash2 /> 本棚を削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ShelfFormSheet open={edit} onOpenChange={setEdit} shelf={shelf} />
      <BookPickerSheet
        open={pick}
        onOpenChange={setPick}
        title={`「${shelf.name}」に本を追加`}
        selectedIds={bookIds}
        onPick={(b) =>
          start(async () => {
            const res = bookIds.includes(b.id) ? await removeBookFromShelfAction(shelf.id, b.id) : await addBookToShelfAction(shelf.id, b.id);
            if (!res.ok) return void toast.error(res.error);
            toast.success(bookIds.includes(b.id) ? `『${b.title}』を外しました` : `『${b.title}』を追加しました`);
            router.refresh();
          })
        }
      />
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent title={`「${shelf.name}」を削除しますか？`} description="本棚だけが削除され、本そのものは削除されません。">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteShelfAction(shelf.id);
                  if (!res.ok) return void toast.error(res.error);
                  router.replace("/shelves");
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

export function RemoveFromShelfButton({ shelfId, bookId, title }: { shelfId: string; bookId: string; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={`『${title}』を本棚から外す`}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await removeBookFromShelfAction(shelfId, bookId);
          if (!res.ok) return void toast.error(res.error);
          router.refresh();
        })
      }
      className="absolute -top-2 -right-2 z-10 flex size-8 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm"
    >
      <X className="size-4" />
    </button>
  );
}
