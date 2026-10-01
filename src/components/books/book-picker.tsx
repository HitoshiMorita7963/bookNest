"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/form-controls";
import { Sheet, SheetContent } from "@/components/ui/overlays";
import { BookCover } from "./book-cover";
import { StatusBadge } from "./bits";
import { pickBooksAction } from "@/server/actions/books";

export interface PickedBook {
  id: string;
  title: string;
  coverImage: string | null;
  status: string;
  authors: { author: { name: string } }[];
}

/** 本を検索して選ぶ Bottom Sheet */
export function BookPickerSheet({
  open,
  onOpenChange,
  onPick,
  title = "本を選ぶ",
  selectedIds = [],
  excludeIds = [],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (book: PickedBook) => void;
  title?: string;
  selectedIds?: string[];
  excludeIds?: string[];
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PickedBook[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await pickBooksAction(q);
        if (!cancelled) setItems(rows as PickedBook[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open]);

  const visible = items.filter((b) => !excludeIds.includes(b.id));

  return (
    <Sheet open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <SheetContent title={title}>
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="タイトル・著者で検索" className="pl-9" aria-label="本を検索" />
          </div>
          {loading && !items.length ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">本が見つかりません</p>
          ) : (
            <ul className="divide-y">
              {visible.map((b) => {
                const selected = selectedIds.includes(b.id);
                return (
                  <li key={b.id}>
                    <button type="button" onClick={() => onPick(b)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-accent/50">
                      <div className="w-10 shrink-0">
                        <BookCover src={b.coverImage} title={b.title} size="xs" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-[15px] font-medium">{b.title}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">{b.authors.map((a) => a.author.name).join("、")}</p>
                      </div>
                      {selected ? <Check className="size-5 text-primary" /> : <StatusBadge status={b.status} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
