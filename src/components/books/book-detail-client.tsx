"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { MoreHorizontal, Pencil, Trash2, FolderPlus, Link2, Loader2, X, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/form-controls";
import {
  Dialog,
  DialogContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
} from "@/components/ui/overlays";
import { deleteBookAction, linkRelatedBookAction, unlinkRelatedBookAction } from "@/server/actions/books";
import { createShelfAction, listShelvesAction, setBookShelvesAction } from "@/server/actions/shelves";
import { deleteRecordAction, deleteSessionAction } from "@/server/actions/reading";
import { RecordSheet } from "@/components/reading/reading-sheets";
import { RatingStars } from "./bits";
import { BookPickerSheet } from "./book-picker";

export function BookMenu({ bookId, title, shelfIds }: { bookId: string; title: string; shelfIds: string[] }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [shelfOpen, setShelfOpen] = useState(false);
  const [relOpen, setRelOpen] = useState(false);
  const [pending, start] = useTransition();

  function onDelete() {
    start(async () => {
      const res = await deleteBookAction(bookId);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`『${title}』を削除しました`);
      router.replace("/books");
      router.refresh();
    });
  }

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
            <Link href={`/books/${bookId}/edit`}>
              <Pencil /> 編集
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShelfOpen(true)}>
            <FolderPlus /> マイ本棚に追加
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setRelOpen(true)}>
            <Link2 /> 関連する本を追加
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirm(true)} className="text-destructive focus:text-destructive">
            <Trash2 /> 削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent title="本を削除しますか？" description={`『${title}』と、その読書記録・読書メモが削除されます。保存したフレーズは本との紐付けが外れて残ります。`}>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              削除する
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ShelfSelectSheet open={shelfOpen} onOpenChange={setShelfOpen} bookId={bookId} initial={shelfIds} />
      <BookPickerSheet
        open={relOpen}
        onOpenChange={setRelOpen}
        title="関連する本を選ぶ"
        excludeIds={[bookId]}
        onPick={(b) => {
          setRelOpen(false);
          start(async () => {
            const res = await linkRelatedBookAction(bookId, b.id);
            if (!res.ok) return void toast.error(res.error);
            toast.success(`『${b.title}』を関連付けました`);
            router.refresh();
          });
        }}
      />
    </>
  );
}

export function ShelfSelectSheet({ open, onOpenChange, bookId, initial }: { open: boolean; onOpenChange: (o: boolean) => void; bookId: string; initial: string[] }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <SheetContent title="マイ本棚に追加" description="複数の本棚に入れられます">
        <ShelfSelectBody bookId={bookId} initial={initial} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function ShelfSelectBody({ bookId, initial, onDone }: { bookId: string; initial: string[]; onDone: () => void }) {
  const router = useRouter();
  const [shelves, setShelves] = useState<{ id: string; name: string }[] | null>(null);
  const [selected, setSelected] = useState<string[]>(initial);
  const [newName, setNewName] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    listShelvesAction().then(setShelves);
  }, []);

  function addShelf() {
    const name = newName.trim();
    if (!name) return;
    start(async () => {
      const res = await createShelfAction({ name });
      if (!res.ok) return void toast.error(res.error);
      setShelves((s) => [...(s ?? []), { id: res.data.id, name }]);
      setSelected((s) => [...s, res.data.id]);
      setNewName("");
    });
  }

  function save() {
    start(async () => {
      const res = await setBookShelvesAction(bookId, selected);
      if (!res.ok) return void toast.error(res.error);
      toast.success("マイ本棚を更新しました");
      onDone();
      router.refresh();
    });
  }

  return (
        <div className="space-y-4">
          {shelves === null ? (
            <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
          ) : shelves.length === 0 ? (
            <p className="text-sm text-muted-foreground">まだ本棚がありません。下で作成できます。</p>
          ) : (
            <ul className="grid gap-1">
              {shelves.map((s) => (
                <li key={s.id}>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-accent">
                    <Checkbox
                      checked={selected.includes(s.id)}
                      onCheckedChange={(c) => setSelected((p) => (c ? [...p, s.id] : p.filter((x) => x !== s.id)))}
                    />
                    <span className="text-[15px]">{s.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="新しい本棚の名前" aria-label="新しい本棚の名前" maxLength={60} />
            <Button variant="outline" onClick={addShelf} disabled={pending || !newName.trim()} className="shrink-0">
              <Plus /> 作成
            </Button>
          </div>
          <Button className="w-full" size="lg" onClick={save} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Check />}
            保存する
          </Button>
        </div>
  );
}

export function UnlinkRelatedButton({ a, b }: { a: string; b: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label="関連付けを解除"
      disabled={pending}
      className="absolute -top-2 -right-2 z-10 flex size-8 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm"
      onClick={() =>
        start(async () => {
          const res = await unlinkRelatedBookAction(a, b);
          if (!res.ok) return void toast.error(res.error);
          router.refresh();
        })
      }
    >
      <X className="size-4" />
    </button>
  );
}

const RECORD_LABEL: Record<string, string> = { READING: "読書中", COMPLETED: "読了", PAUSED: "中断", DROPPED: "読了断念" };

export function RecordCard({
  record,
  bookId,
  bookTitle,
  index,
  total,
}: {
  record: {
    id: string;
    status: string;
    startedAt: Date | null;
    finishedAt: Date | null;
    rating: number | null;
    review: string | null;
    summary: string | null;
    learned: string | null;
    memorable: string | null;
    questions: string | null;
  };
  bookId: string;
  bookTitle: string;
  index: number;
  total: number;
}) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const fmt = (d: Date | null) => (d ? format(d, "yyyy/M/d") : "—");
  const sections = [
    ["感想", record.review],
    ["要約", record.summary],
    ["学んだこと", record.learned],
    ["印象に残ったこと", record.memorable],
    ["疑問点", record.questions],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <article className="rounded-xl border bg-card p-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            {total > 1 ? `${total - index}回目の読書` : "読書記録"}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{RECORD_LABEL[record.status] ?? record.status}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {fmt(record.startedAt)} 〜 {fmt(record.finishedAt)}
          </p>
          <RatingStars value={record.rating} size="md" className="mt-1" />
        </div>
        <div className="flex">
          <Button variant="ghost" size="icon-sm" aria-label="読書記録を編集" onClick={() => setEdit(true)}>
            <Pencil />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="読書記録を削除" onClick={() => setConfirm(true)}>
            <Trash2 />
          </Button>
        </div>
      </header>
      {sections.length ? (
        <dl className="mt-3 space-y-3">
          {sections.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
              <dd className="prose-note mt-1 text-[15px] leading-relaxed">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <button type="button" onClick={() => setEdit(true)} className="mt-3 text-sm text-primary underline-offset-4 hover:underline">
          ＋ 感想・学んだことを書く
        </button>
      )}
      <RecordSheet open={edit} onOpenChange={setEdit} mode="edit" bookId={bookId} bookTitle={bookTitle} record={record} />
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent title="この読書記録を削除しますか？">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteRecordAction(record.id, bookId);
                  if (!res.ok) return void toast.error(res.error);
                  setConfirm(false);
                  router.refresh();
                })
              }
            >
              削除する
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}

export function DeleteSessionButton({ id, bookId }: { id: string; bookId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="この記録を削除"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("この読書メモ・進捗記録を削除しますか？")) return;
        start(async () => {
          const res = await deleteSessionAction(id, bookId);
          if (!res.ok) return void toast.error(res.error);
          router.refresh();
        });
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
