import Link from "next/link";
import { Camera, Heart } from "lucide-react";
import { prisma } from "@/lib/db";
import { listQuotes, quoteTags } from "@/server/services/quotes";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBox } from "@/components/search/search-box";
import { QuoteCard } from "@/components/quotes/quote-card";
import { EmptyState } from "@/components/books/bits";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "フレーズ" };

type SP = { q?: string; tag?: string; bookId?: string; authorId?: string; fav?: string; page?: string };

function href(sp: SP, patch: Partial<SP>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, String(v));
  p.delete("page");
  if (patch.page) p.set("page", patch.page);
  const qs = p.toString();
  return qs ? `/quotes?${qs}` : "/quotes";
}

export default async function QuotesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [result, tags, filterBook, total] = await Promise.all([
    listQuotes(prisma, { q: sp.q?.slice(0, 100), tag: sp.tag, bookId: sp.bookId, authorId: sp.authorId, favorite: sp.fav === "1", pageSize: 30 * page }),
    quoteTags(prisma),
    sp.bookId ? prisma.book.findUnique({ where: { id: sp.bookId }, select: { title: true } }) : null,
    prisma.quote.count(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="フレーズ"
        subtitle={`${total}件`}
        actions={
          <Button asChild size="sm">
            <Link href="/quotes/new">
              <Camera /> 保存
            </Link>
          </Button>
        }
      />
      {total === 0 ? (
        <EmptyState
          icon="💬"
          title="まだフレーズがありません"
          description="読書中に心に残った文章を、スマホで撮影して保存しましょう。文字は自動で読み取られます。"
          action={
            <Button asChild size="lg">
              <Link href="/quotes/new">
                <Camera /> フレーズを撮影
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <SearchBox initial={sp.q ?? ""} placeholder="フレーズ・本・著者・タグ・メモ" autoFocus={false} />
          <nav className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" aria-label="タグで絞り込み">
            <Link href={href(sp, { tag: undefined, fav: undefined })} className={chip(!sp.tag && sp.fav !== "1")}>
              すべて
            </Link>
            <Link href={href(sp, { fav: sp.fav === "1" ? undefined : "1", tag: undefined })} className={chip(sp.fav === "1")}>
              <Heart className="size-3.5" /> お気に入り
            </Link>
            {tags.map((t) => (
              <Link key={t.name} href={href(sp, { tag: sp.tag === t.name ? undefined : t.name, fav: undefined })} className={chip(sp.tag === t.name)}>
                #{t.name}
                <span className="text-xs opacity-70">{t._count.quotes}</span>
              </Link>
            ))}
          </nav>
          {filterBook ? (
            <p className="flex items-center gap-2 text-sm">
              『{filterBook.title}』のフレーズ
              <Link href={href(sp, { bookId: undefined })} className="text-primary underline">
                解除
              </Link>
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {result.total}件
          </p>
          {result.items.length === 0 ? (
            <EmptyState icon="🔍" title="該当するフレーズはありません" />
          ) : (
            <div className="space-y-3 lg:columns-2 lg:gap-4 lg:space-y-0 [&>*]:lg:mb-4 [&>*]:lg:break-inside-avoid">
              {result.items.map((q) => (
                <QuoteCard key={q.id} quote={q} highlight={sp.q?.split(/\s+/)[0]} />
              ))}
            </div>
          )}
          {result.hasMore ? (
            <div className="flex justify-center">
              <Button asChild variant="outline" size="lg">
                <Link href={href(sp, { page: String(page + 1) })} scroll={false}>
                  さらに表示
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function chip(active: boolean) {
  return cn(
    "flex h-9 shrink-0 items-center gap-1 rounded-full border px-3.5 text-sm",
    active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
  );
}
