"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, X, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { Sheet, SheetContent } from "@/components/ui/overlays";
import { BookPickerSheet } from "@/components/books/book-picker";
import { createKnowledgeAction, pickQuotesAction, updateKnowledgeAction } from "@/server/actions/knowledge";
import { splitList, truncate } from "@/lib/utils";

export interface KnowledgeFormValues {
  title: string;
  content: string;
  category: string;
  tags: string;
  books: { id: string; title: string }[];
  quotes: { id: string; text: string }[];
}

export function KnowledgeForm({
  id,
  initial,
  categories = [],
  aiProposal = false,
}: {
  id?: string;
  initial: KnowledgeFormValues;
  categories?: string[];
  /** AI 提案を元にしたフォームの場合は注意書きを出す */
  aiProposal?: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [bookOpen, setBookOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [pending, start] = useTransition();
  useEffect(() => setV(initial), [initial]);

  function save() {
    if (!v.title.trim()) return void toast.error("タイトルを入力してください");
    start(async () => {
      const payload = {
        title: v.title,
        content: v.content,
        category: v.category,
        tags: splitList(v.tags),
        bookIds: v.books.map((b) => b.id),
        quoteIds: v.quotes.map((q) => q.id),
      };
      const res = id ? await updateKnowledgeAction(id, payload) : await createKnowledgeAction(payload);
      if (!res.ok) return void toast.error(res.error);
      toast.success(id ? "知識ノートを更新しました" : "知識ノートを保存しました");
      router.push(`/knowledge/${res.data.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {aiProposal ? (
        <p className="flex gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 text-sm">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>AI提案です。内容を確認・編集してから保存してください。保存するまで登録されません。</span>
        </p>
      ) : null}
      {v.quotes.length ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">元にしたフレーズ</p>
          {v.quotes.map((q) => (
            <div key={q.id} className="flex items-start gap-2 rounded-xl bg-muted/60 p-3">
              <p className="quote-text flex-1 text-sm">「{truncate(q.text, 120)}」</p>
              <button type="button" aria-label="フレーズの紐付けを外す" onClick={() => setV({ ...v, quotes: v.quotes.filter((x) => x.id !== q.id) })} className="flex size-8 items-center justify-center rounded-full hover:bg-accent">
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <Field label="タイトル（得た知識・考え方）" htmlFor="k-title">
        <Input id="k-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="例：金融政策の基本" maxLength={200} />
      </Field>
      <Field label="内容" htmlFor="k-content">
        <Textarea id="k-content" value={v.content} onChange={(e) => setV({ ...v, content: e.target.value })} rows={8} className="min-h-48" placeholder="自分の言葉で理解したことを書きましょう" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="カテゴリ" htmlFor="k-cat">
          <Input id="k-cat" list="k-cats" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} placeholder="経済・哲学など" maxLength={60} />
          <datalist id="k-cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="タグ" htmlFor="k-tags" hint="「、」区切り">
          <Input id="k-tags" value={v.tags} onChange={(e) => setV({ ...v, tags: e.target.value })} />
        </Field>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">関連する本</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setBookOpen(true)}>
            <Plus /> 本を追加
          </Button>
        </div>
        {v.books.length ? (
          <ul className="flex flex-wrap gap-2">
            {v.books.map((b) => (
              <li key={b.id} className="flex h-9 items-center gap-1 rounded-full border bg-card pr-1 pl-3 text-sm">
                『{truncate(b.title, 20)}』
                <button type="button" aria-label={`『${b.title}』を外す`} onClick={() => setV({ ...v, books: v.books.filter((x) => x.id !== b.id) })} className="flex size-7 items-center justify-center rounded-full hover:bg-accent">
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">この知識を得た本・関係する本を紐付けましょう</p>
        )}
      </div>

      <Button type="button" variant="ghost" className="w-full" onClick={() => setQuoteOpen(true)}>
        <Plus /> 関連するフレーズを紐付ける
      </Button>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:px-0">
        <Button size="lg" className="w-full" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {id ? "更新する" : "保存する"}
        </Button>
      </div>

      <BookPickerSheet
        open={bookOpen}
        onOpenChange={setBookOpen}
        title="関連する本を選ぶ"
        selectedIds={v.books.map((b) => b.id)}
        onPick={(b) => {
          setV((p) => ({ ...p, books: p.books.some((x) => x.id === b.id) ? p.books.filter((x) => x.id !== b.id) : [...p.books, { id: b.id, title: b.title }] }));
        }}
      />
      <QuotePickerSheet
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        selectedIds={v.quotes.map((q) => q.id)}
        onPick={(q) => setV((p) => ({ ...p, quotes: p.quotes.some((x) => x.id === q.id) ? p.quotes.filter((x) => x.id !== q.id) : [...p.quotes, q] }))}
      />
    </div>
  );
}

function QuotePickerSheet({
  open,
  onOpenChange,
  selectedIds,
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  selectedIds: string[];
  onPick: (q: { id: string; text: string }) => void;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Awaited<ReturnType<typeof pickQuotesAction>>>([]);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => pickQuotesAction(q).then(setItems), 250);
    return () => clearTimeout(t);
  }, [q, open]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <SheetContent title="フレーズを選ぶ">
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="フレーズ・本で検索" className="pl-9" aria-label="フレーズを検索" />
          </div>
          <ul className="divide-y">
            {items.map((it) => (
              <li key={it.id}>
                <button type="button" onClick={() => onPick({ id: it.id, text: it.text })} className="flex w-full items-start gap-2 py-3 text-left">
                  <span className="flex-1">
                    <span className="quote-text line-clamp-3 text-sm">「{it.text}」</span>
                    {it.book ? <span className="mt-0.5 block text-xs text-muted-foreground">『{it.book.title}』</span> : null}
                  </span>
                  {selectedIds.includes(it.id) ? <span className="text-xs font-semibold text-primary">選択中</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
