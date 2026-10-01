"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp, LayoutGrid, List, SlidersHorizontal, Search, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/form-controls";
import { Sheet, SheetContent } from "@/components/ui/overlays";
import { BOOK_STATUSES, SORT_OPTIONS, STATUS_LABEL, type SortKey } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface Facets {
  genres: string[];
  tags: { id: string; name: string }[];
  authors: { id: string; name: string }[];
}

const FILTER_KEYS = ["genre", "tag", "authorId", "minRating", "publishedFrom", "publishedTo", "finishedYear", "minPages", "maxPages"] as const;

function useParamsUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return {
    sp,
    update(patch: Record<string, string | null | undefined>) {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, v);
      }
      next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
  };
}

export function ShelfControls({ facets, counts, total }: { facets: Facets; counts: Record<string, number>; total: number }) {
  const { sp, update } = useParamsUpdater();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const status = sp.get("status") ?? "";
  const view = sp.get("view") ?? "grid";
  const sort = (sp.get("sort") as SortKey) ?? "createdAt";
  const order = sp.get("order") ?? "";
  const activeFilters = FILTER_KEYS.filter((k) => sp.get(k)).length;

  useEffect(() => {
    const t = setTimeout(() => {
      if ((sp.get("q") ?? "") !== q) update({ q });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="タイトル・著者・タグ・ISBN"
            className="pl-9"
            aria-label="本棚を検索"
            inputMode="search"
            enterKeyHint="search"
          />
          {q ? (
            <button type="button" onClick={() => setQ("")} aria-label="検索語を消去" className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground">
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <Button variant="outline" size="icon" onClick={() => setFilterOpen(true)} aria-label={`絞り込み${activeFilters ? `（${activeFilters}件適用中）` : ""}`} className="relative">
          <SlidersHorizontal />
          {activeFilters ? (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{activeFilters}</span>
          ) : null}
        </Button>
        <Button variant="outline" size="icon" onClick={() => setSortOpen(true)} aria-label="並び替え">
          <ArrowDownUp />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => update({ view: view === "grid" ? "list" : null })}
          aria-label={view === "grid" ? "リスト表示に切り替え" : "グリッド表示に切り替え"}
        >
          {view === "grid" ? <List /> : <LayoutGrid />}
        </Button>
      </div>

      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" role="tablist" aria-label="ステータス">
        <Chip active={!status} onClick={() => update({ status: null })} label="すべて" count={allCount} />
        {BOOK_STATUSES.map((s) => (
          <Chip key={s} active={status === s} onClick={() => update({ status: s })} label={STATUS_LABEL[s]} count={counts[s] ?? 0} />
        ))}
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {total}冊 ・ {SORT_OPTIONS[sort] ?? "追加日"}順
      </p>

      <Sheet open={sortOpen} onOpenChange={setSortOpen}>
        <SheetContent title="並び替え">
          <ul className="grid gap-1">
            {(Object.keys(SORT_OPTIONS) as SortKey[]).map((k) => (
              <li key={k}>
                <button
                  type="button"
                  className="flex h-12 w-full items-center justify-between rounded-lg px-3 text-left hover:bg-accent"
                  onClick={() => {
                    update({ sort: k === "createdAt" ? null : k });
                    setSortOpen(false);
                  }}
                >
                  {SORT_OPTIONS[k]}
                  {sort === k ? <Check className="size-5 text-primary" /> : null}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant={order === "asc" ? "default" : "outline"} onClick={() => { update({ order: "asc" }); setSortOpen(false); }}>
              昇順
            </Button>
            <Button variant={order === "desc" ? "default" : "outline"} onClick={() => { update({ order: "desc" }); setSortOpen(false); }}>
              降順
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <FilterSheet open={filterOpen} onOpenChange={setFilterOpen} facets={facets} sp={sp} onApply={(p) => { update(p); setFilterOpen(false); }} />
    </div>
  );
}

function Chip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
      )}
    >
      {label}
      <span className={cn("text-xs", active ? "opacity-80" : "text-muted-foreground")}>{count}</span>
    </button>
  );
}

function FilterSheet({
  open,
  onOpenChange,
  facets,
  sp,
  onApply,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  facets: Facets;
  sp: URLSearchParams;
  onApply: (patch: Record<string, string | null>) => void;
}) {
  const [v, setV] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open) setV(Object.fromEntries(FILTER_KEYS.map((k) => [k, sp.get(k) ?? ""])));
  }, [open, sp]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((p) => ({ ...p, [k]: e.target.value }));
  const thisYear = new Date().getFullYear();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="絞り込み">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="f-genre">ジャンル</Label>
            <NativeSelect id="f-genre" value={v.genre ?? ""} onChange={set("genre")}>
              <option value="">すべて</option>
              {facets.genres.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="f-tag">タグ</Label>
            <NativeSelect id="f-tag" value={v.tag ?? ""} onChange={set("tag")}>
              <option value="">すべて</option>
              {facets.tags.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="f-author">著者</Label>
            <NativeSelect id="f-author" value={v.authorId ?? ""} onChange={set("authorId")}>
              <option value="">すべて</option>
              {facets.authors.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="f-rating">評価</Label>
            <NativeSelect id="f-rating" value={v.minRating ?? ""} onChange={set("minRating")}>
              <option value="">指定なし</option>
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>{"★".repeat(r)} 以上</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="f-fy">読了年</Label>
            <NativeSelect id="f-fy" value={v.finishedYear ?? ""} onChange={set("finishedYear")}>
              <option value="">指定なし</option>
              {Array.from({ length: 15 }, (_, i) => thisYear - i).map((y) => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </NativeSelect>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">出版年</legend>
            <div className="flex items-center gap-2">
              <Input inputMode="numeric" placeholder="1990" value={v.publishedFrom ?? ""} onChange={set("publishedFrom")} aria-label="出版年（から）" />
              <span>〜</span>
              <Input inputMode="numeric" placeholder={String(thisYear)} value={v.publishedTo ?? ""} onChange={set("publishedTo")} aria-label="出版年（まで）" />
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">ページ数</legend>
            <div className="flex items-center gap-2">
              <Input inputMode="numeric" placeholder="0" value={v.minPages ?? ""} onChange={set("minPages")} aria-label="ページ数（以上）" />
              <span>〜</span>
              <Input inputMode="numeric" placeholder="1000" value={v.maxPages ?? ""} onChange={set("maxPages")} aria-label="ページ数（以下）" />
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="outline" onClick={() => onApply(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))}>
              クリア
            </Button>
            <Button onClick={() => onApply(Object.fromEntries(FILTER_KEYS.map((k) => [k, v[k]?.normalize("NFKC").trim() || null])))}>
              適用する
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
