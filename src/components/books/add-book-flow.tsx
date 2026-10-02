"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ScanBarcode, Search, PenLine, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { BarcodeScanner } from "./barcode-scanner";
import { BookForm, metadataToForm, type BookFormValues } from "./book-form";
import { BookCover } from "./book-cover";
import { lookupIsbnAction, searchMetadataAction } from "@/server/actions/books";
import type { BookMetadata } from "@/server/services/metadata";
import { parseIsbn } from "@/lib/isbn";

type Mode = "scan" | "search" | "manual";

export function AddBookFlow({ initialMode = "search", initialQuery = "" }: { initialMode?: Mode; initialQuery?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<BookMetadata[] | null>(null);
  const [selected, setSelected] = useState<Partial<BookFormValues> | null>(null);
  const [selectedMeta, setSelectedMeta] = useState<BookMetadata | null>(null);
  const [notFoundIsbn, setNotFoundIsbn] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const lookup = useCallback(
    (isbn: string) => {
      setNotFoundIsbn(null);
      startTransition(async () => {
        const res = await lookupIsbnAction(isbn);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        if (res.data.existing) {
          toast.info(`『${res.data.existing.title}』は登録済みです`, {
            action: { label: "開く", onClick: () => router.push(`/books/${res.data.existing!.id}`) },
          });
          return;
        }
        if (!res.data.metadata) {
          setNotFoundIsbn(isbn);
          toast.warning("書籍情報が見つかりませんでした。手動で入力できます。");
          setSelected({ isbn });
          setSelectedMeta(null);
          return;
        }
        setSelected({ ...metadataToForm(res.data.metadata), status: "WANT_TO_READ" });
        setSelectedMeta(res.data.metadata);
      });
    },
    [router],
  );

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (parseIsbn(q)) {
      lookup(q);
      return;
    }
    if (/^[\d\-\sXx]{9,17}$/.test(q)) {
      toast.error("ISBNの形式が正しくありません。数字を確認してください。");
      return;
    }
    startTransition(async () => {
      const res = await searchMetadataAction(q);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResults(res.data);
      if (!res.data.length) toast.info("見つかりませんでした。手入力で登録できます。");
    });
  }

  if (selected) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="-ml-2">
          <ArrowLeft /> 検索に戻る
        </Button>
        {notFoundIsbn ? (
          <p className="rounded-lg bg-accent p-3 text-sm">ISBN {notFoundIsbn} の情報が見つからなかったため、手動で入力してください。</p>
        ) : (
          <p className="text-sm text-muted-foreground">内容を確認して登録してください。ステータスもここで選べます。</p>
        )}
        <BookForm defaultValues={selected} submitLabel="本棚に追加" compact classifyFrom={selectedMeta ?? undefined} />
      </div>
    );
  }

  return (
    <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
      <TabsList className="grid grid-cols-3">
        <TabsTrigger value="scan">
          <ScanBarcode className="size-4" /> スキャン
        </TabsTrigger>
        <TabsTrigger value="search">
          <Search className="size-4" /> 検索
        </TabsTrigger>
        <TabsTrigger value="manual">
          <PenLine className="size-4" /> 手入力
        </TabsTrigger>
      </TabsList>

      <TabsContent value="scan" className="space-y-4">
        <BarcodeScanner onDetected={lookup} paused={pending} />
        {pending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> 書籍情報を検索しています…
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          読み取れない場合は「検索」タブでISBNを入力してください。
        </p>
      </TabsContent>

      <TabsContent value="search" className="space-y-4">
        <form onSubmit={onSearch} className="flex gap-2" role="search">
          <label htmlFor="isbn-q" className="sr-only">
            ISBN またはタイトル
          </label>
          <Input
            id="isbn-q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ISBN（978…）またはタイトル"
            inputMode="search"
            enterKeyHint="search"
            autoFocus={initialMode === "search"}
            autoComplete="off"
          />
          <Button type="submit" disabled={pending || !query.trim()} className="shrink-0">
            {pending ? <Loader2 className="animate-spin" /> : <Search />}
            検索
          </Button>
        </form>
        {results ? (
          results.length ? (
            <ul className="divide-y rounded-xl border bg-card">
              {results.map((r, i) => (
                <li key={(r.isbn13 ?? "") + i}>
                  <button
                    type="button"
                    className="flex w-full gap-3 p-3 text-left hover:bg-accent/60"
                    onClick={() => {
                      setSelected({ ...metadataToForm(r), status: "WANT_TO_READ" });
                      setSelectedMeta(r);
                    }}
                  >
                    <div className="w-12 shrink-0">
                      <BookCover src={r.coverImage} title={r.title} size="xs" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[15px] font-medium">{r.title}</p>
                      <p className="line-clamp-1 text-sm text-muted-foreground">{r.authors.join("、") || "著者不明"}</p>
                      <p className="text-xs text-muted-foreground">
                        {[r.publisher, r.publishedAt].filter(Boolean).join(" ・ ")}
                      </p>
                    </div>
                    <ChevronRight className="size-5 self-center text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              見つかりませんでした。
              <button type="button" className="ml-1 text-primary underline" onClick={() => setMode("manual")}>
                手入力で登録
              </button>
            </p>
          )
        ) : (
          <div className="rounded-xl bg-muted/60 p-4 text-sm leading-relaxed text-muted-foreground">
            <p>ISBN を入力すると、タイトル・著者・出版社・ページ数・書影などを自動で取得します。</p>
            <p className="mt-1">ISBN は本の裏表紙やバーコードの上に「978」から始まる13桁で記載されています。</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="manual">
        <BookForm submitLabel="本棚に追加" />
      </TabsContent>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link href="/books" className="underline">
          本棚に戻る
        </Link>
      </p>
    </Tabs>
  );
}
