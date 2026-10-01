"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, Heart, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, Checkbox } from "@/components/ui/form-controls";
import { BookPickerSheet, type PickedBook } from "@/components/books/book-picker";
import { BookCover } from "@/components/books/book-cover";
import { createQuoteAction, listTagNamesAction, updateQuoteAction } from "@/server/actions/quotes";
import { splitList, cn } from "@/lib/utils";

export interface QuoteFormValues {
  text: string;
  pageNumber: string;
  note: string;
  tags: string;
  isFavorite: boolean;
  book: { id: string; title: string; coverImage: string | null } | null;
  originalImage: string | null;
}

export function QuoteForm({
  quoteId,
  initial,
  textSlot,
  beforeSave,
  onSaved,
}: {
  quoteId?: string;
  initial: QuoteFormValues;
  /** OCR 画面では本文欄の上に「再OCR」などを差し込む */
  textSlot?: React.ReactNode;
  /** 保存直前の処理（画像アップロード等）。originalImage を返す */
  beforeSave?: () => Promise<string | null | undefined>;
  onSaved?: (id: string) => void;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pickOpen, setPickOpen] = useState(false);
  const [tagSuggest, setTagSuggest] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => setV((p) => ({ ...p, text: initial.text })), [initial.text]);
  useEffect(() => {
    listTagNamesAction().then(setTagSuggest).catch(() => undefined);
  }, []);

  const currentTags = splitList(v.tags);
  function toggleTag(t: string) {
    const next = currentTags.includes(t) ? currentTags.filter((x) => x !== t) : [...currentTags, t];
    setV({ ...v, tags: next.join("、") });
  }

  function save() {
    setError(null);
    if (!v.text.trim()) {
      setError("フレーズを入力してください");
      return;
    }
    start(async () => {
      let image = v.originalImage;
      try {
        if (beforeSave) image = (await beforeSave()) ?? null;
      } catch (e) {
        toast.warning(`画像を保存できませんでした（${(e as Error).message}）。テキストのみ保存します。`);
        image = null;
      }
      const payload = {
        text: v.text,
        pageNumber: v.pageNumber,
        note: v.note,
        tags: currentTags,
        isFavorite: v.isFavorite,
        bookId: v.book?.id ?? null,
        originalImage: image,
      };
      const res = quoteId ? await updateQuoteAction(quoteId, payload) : await createQuoteAction(payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(quoteId ? "フレーズを更新しました" : "フレーズを保存しました");
      if (onSaved) onSaved(res.data.id);
      else {
        router.push(`/quotes/${res.data.id}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-end justify-between gap-2">
          <label htmlFor="q-text" className="text-sm font-medium">
            フレーズ
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">{v.text.length}文字</span>
        </div>
        {textSlot}
        <Textarea
          id="q-text"
          value={v.text}
          onChange={(e) => setV({ ...v, text: e.target.value })}
          rows={7}
          className="quote-text min-h-44 text-[17px]"
          placeholder="心に残った文章"
          aria-invalid={!!error}
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">出典の本</p>
        <button type="button" onClick={() => setPickOpen(true)} className="flex min-h-16 w-full items-center gap-3 rounded-xl border bg-card p-2.5 text-left hover:bg-accent/50">
          {v.book ? (
            <>
              <div className="w-10 shrink-0">
                <BookCover src={v.book.coverImage} title={v.book.title} size="xs" />
              </div>
              <span className="line-clamp-2 flex-1 font-medium">『{v.book.title}』</span>
              <span className="text-sm text-primary">変更</span>
            </>
          ) : (
            <>
              <span className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <BookOpen className="size-5 text-muted-foreground" />
              </span>
              <span className="flex-1 text-muted-foreground">本を選ぶ</span>
            </>
          )}
        </button>
        {v.book ? (
          <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setV({ ...v, book: null })}>
            本との紐付けを外す
          </button>
        ) : null}
      </div>

      <Field label="ページ" htmlFor="q-page" hint="例：142 / 142-143 / 序章 / 位置No.1234">
        <Input id="q-page" value={v.pageNumber} onChange={(e) => setV({ ...v, pageNumber: e.target.value })} maxLength={40} inputMode="text" />
      </Field>

      <Field label="タグ" htmlFor="q-tags" hint="「、」区切り">
        <Input id="q-tags" value={v.tags} onChange={(e) => setV({ ...v, tags: e.target.value })} placeholder="人生、仕事" />
        {tagSuggest.length ? (
          <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pt-1">
            {tagSuggest.slice(0, 40).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                className={cn(
                  "h-8 shrink-0 rounded-full border px-3 text-xs",
                  currentTags.includes(t) ? "border-primary bg-primary/10 text-primary" : "bg-card text-muted-foreground",
                )}
              >
                #{t}
              </button>
            ))}
          </div>
        ) : null}
      </Field>

      <Field label="自分のメモ（なぜ残したのか）" htmlFor="q-note">
        <Textarea id="q-note" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} rows={3} placeholder="今の自分にも当てはまる…" />
      </Field>

      <label className="flex min-h-11 items-center gap-3">
        <Checkbox checked={v.isFavorite} onCheckedChange={(c) => setV({ ...v, isFavorite: c === true })} />
        <Heart className={cn("size-4", v.isFavorite ? "fill-rose-500 text-rose-500" : "text-muted-foreground")} />
        <span className="text-[15px]">お気に入り</span>
      </label>

      {v.originalImage && quoteId ? (
        <div className="flex items-center gap-3 rounded-xl border p-2">
          <img src={v.originalImage} alt="元画像" className="h-16 w-16 rounded object-cover" />
          <span className="flex-1 text-sm text-muted-foreground">元画像</span>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="元画像を削除" onClick={() => setV({ ...v, originalImage: null })}>
            <X />
          </Button>
        </div>
      ) : null}

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0">
        <Button size="lg" className="w-full" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {quoteId ? "更新する" : "保存する"}
        </Button>
      </div>

      <BookPickerSheet
        open={pickOpen}
        onOpenChange={setPickOpen}
        title="出典の本を選ぶ"
        selectedIds={v.book ? [v.book.id] : []}
        onPick={(b: PickedBook) => {
          setV({ ...v, book: { id: b.id, title: b.title, coverImage: b.coverImage } });
          setPickOpen(false);
        }}
      />
    </div>
  );
}
