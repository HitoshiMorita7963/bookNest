import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Plus, MessageSquareQuote, Brain, FolderHeart, Route } from "lucide-react";
import { prisma } from "@/lib/db";
import { getBookDetail, autoRelatedBooks } from "@/server/services/books";
import { PageHeader } from "@/components/layout/page-header";
import { BookCover } from "@/components/books/book-cover";
import { RatingStars, SectionTitle, TagChip, authorNames } from "@/components/books/bits";
import { BookStatusPanel } from "@/components/reading/reading-actions";
import { BookMenu, DeleteSessionButton, RecordCard, UnlinkRelatedButton } from "@/components/books/book-detail-client";
import { Button } from "@/components/ui/button";
import { QuoteCard } from "@/components/quotes/quote-card";
import { formatNumber } from "@/lib/utils";
import { CreativeUsageSection } from "@/components/creative/usage-section";
import { ReadMore } from "@/components/ui/read-more";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await prisma.book.findUnique({ where: { id }, select: { title: true } });
  return { title: b?.title ?? "本" };
}

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [book, auto] = await Promise.all([getBookDetail(prisma, id), autoRelatedBooks(prisma, id, 8)]);
  if (!book) notFound();
  const manual = [
    ...book.relatedTo.map((r) => r.to),
    ...book.relatedBy.map((r) => r.from),
  ];
  const manualIds = new Set(manual.map((m) => m.id));
  const autoFiltered = auto.filter((a) => !manualIds.has(a.book.id)).slice(0, 6);

  const meta: [string, React.ReactNode][] = (
    [
      ["出版社", book.publisher],
      ["発売日", book.publishedAt],
      ["ページ数", book.pageCount ? `${formatNumber(book.pageCount)}ページ` : null],
      ["ISBN", book.isbn13 ?? book.isbn10],
      ["ジャンル", book.genre ? <Link key="g" href={`/books?genre=${encodeURIComponent(book.genre)}`} className="text-primary hover:underline">{book.genre}</Link> : null],
      ["入手日", book.acquiredAt ? format(book.acquiredAt, "yyyy/M/d") : null],
      ["登録日", format(book.createdAt, "yyyy/M/d")],
    ] as [string, React.ReactNode][]
  ).filter(([, v]) => v);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={book.title} back actions={<BookMenu bookId={book.id} title={book.title} shelfIds={book.shelves.map((s) => s.shelfId)} />} />

      <div className="grid gap-6 md:grid-cols-[220px_1fr] md:gap-10">
        {/* 書誌情報 */}
        <section aria-label="書誌情報" className="flex gap-4 md:flex-col">
          <div className="w-32 shrink-0 sm:w-40 md:w-full">
            <BookCover src={book.coverImage} title={book.title} author={authorNames(book, 1)} size="lg" priority />
          </div>
          <div className="min-w-0 flex-1 md:hidden">
            <BookHeading book={book} />
          </div>
        </section>

        <div className="min-w-0 space-y-8">
          <div className="hidden md:block">
            <BookHeading book={book} />
          </div>

          <BookStatusPanel book={{ id: book.id, title: book.title, status: book.status, currentPage: book.currentPage, pageCount: book.pageCount }} />

          {book.tags.length ? (
            <div className="flex flex-wrap gap-1.5">
              {book.tags.map((t) => (
                <TagChip key={t.tagId} name={t.tag.name} href={`/books?tag=${encodeURIComponent(t.tag.name)}`} />
              ))}
            </div>
          ) : null}

          {/* 読書記録 */}
          <section>
            <SectionTitle>📖 読書記録 {book.records.length > 1 ? <span className="text-sm font-normal text-muted-foreground">（{book.records.length}回）</span> : null}</SectionTitle>
            {book.records.length ? (
              <div className="space-y-3">
                {book.records.map((r, i) => (
                  <RecordCard key={r.id} record={r} bookId={book.id} bookTitle={book.title} index={i} total={book.records.length} />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">読み始めると、ここに読書記録（開始日・読了日・評価・感想）が残ります。</p>
            )}
          </section>

          {/* フレーズ */}
          <section>
            <SectionTitle
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href={`/quotes/new?bookId=${book.id}`}>
                    <Plus /> フレーズを保存
                  </Link>
                </Button>
              }
            >
              <MessageSquareQuote className="size-5 text-primary" /> 保存したフレーズ
              <span className="text-sm font-normal text-muted-foreground">{book._count.quotes}件</span>
            </SectionTitle>
            {book.quotes.length ? (
              <div className="space-y-3">
                {book.quotes.slice(0, 5).map((q) => (
                  <QuoteCard key={q.id} quote={{ ...q, book: null }} />
                ))}
                {book.quotes.length > 5 ? (
                  <Link href={`/quotes?bookId=${book.id}`} className="block text-center text-sm text-primary hover:underline">
                    すべてのフレーズを見る（{book.quotes.length}件）
                  </Link>
                ) : null}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">心に残った文章を撮影して保存できます。</p>
            )}
          </section>

          {/* 知識 */}
          <section>
            <SectionTitle
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href={`/knowledge/new?bookId=${book.id}`}>
                    <Plus /> 知識を追加
                  </Link>
                </Button>
              }
            >
              <Brain className="size-5 text-primary" /> 関連する知識
            </SectionTitle>
            {book.knowledge.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {book.knowledge.map(({ knowledge: k }) => (
                  <li key={k.id}>
                    <Link href={`/knowledge/${k.id}`} className="block rounded-xl border bg-card p-3 hover:bg-accent/50">
                      <p className="font-medium">🧠 {k.title}</p>
                      {k.content ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{k.content}</p> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">この本から得た知識・理解をノートとして残しましょう。</p>
            )}
          </section>

          <CreativeUsageSection source={{ kind: "book", id: book.id }} defaultTitle={book.title} defaultContent={`『${book.title}』から`} />

          {/* 読書メモ */}
          {book.sessions.some((s) => s.note) ? (
            <section>
              <SectionTitle>📝 読書メモ</SectionTitle>
              <ol className="space-y-2">
                {book.sessions
                  .filter((s) => s.note)
                  .map((s) => (
                    <li key={s.id} className="flex gap-2 rounded-xl border bg-card p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {format(s.date, "yyyy/M/d HH:mm")}
                          {s.endPage != null ? ` ・ p.${s.endPage}` : ""}
                        </p>
                        <ReadMore as="p" className="prose-note mt-1 text-[15px]">
                          {s.note}
                        </ReadMore>
                      </div>
                      <DeleteSessionButton id={s.id} bookId={book.id} />
                    </li>
                  ))}
              </ol>
            </section>
          ) : null}

          {/* シリーズ */}
          {book.series ? (
            <section>
              <SectionTitle action={<Link href={`/series/${book.series.id}`} className="text-sm text-primary hover:underline">シリーズを見る</Link>}>
                📚 {book.series.title}
              </SectionTitle>
              <ul className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 md:mx-0 md:px-0">
                {book.series.books.map((sb) => (
                  <li key={sb.id} className="w-20 shrink-0">
                    <Link href={`/books/${sb.id}`} className={sb.id === book.id ? "block rounded-md ring-2 ring-primary ring-offset-2 ring-offset-background" : "block"}>
                      <BookCover src={sb.coverImage} title={sb.title} size="xs" />
                    </Link>
                    <p className="mt-1 text-center text-xs text-muted-foreground">{sb.seriesNumber != null ? `${sb.seriesNumber}巻` : ""}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* 関連する本 */}
          {manual.length || autoFiltered.length ? (
            <section>
              <SectionTitle>🔗 関連する本</SectionTitle>
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {manual.map((m) => (
                  <li key={m.id} className="relative">
                    <UnlinkRelatedButton a={book.id} b={m.id} />
                    <Link href={`/books/${m.id}`}>
                      <BookCover src={m.coverImage} title={m.title} size="sm" />
                      <p className="mt-1 line-clamp-2 text-xs">{m.title}</p>
                    </Link>
                  </li>
                ))}
                {autoFiltered.map(({ book: m, reason }) => (
                  <li key={m.id}>
                    <Link href={`/books/${m.id}`}>
                      <BookCover src={m.coverImage} title={m.title} size="sm" />
                      <p className="mt-1 line-clamp-2 text-xs">{m.title}</p>
                      <p className="text-[10px] text-muted-foreground">{reason}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {book.shelves.length || book.paths.length ? (
            <section className="flex flex-wrap gap-2">
              {book.shelves.map((s) => (
                <Link key={s.shelfId} href={`/shelves/${s.shelfId}`} className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-card px-3 text-sm hover:bg-accent">
                  <FolderHeart className="size-4 text-primary" /> {s.shelf.name}
                </Link>
              ))}
              {book.paths.map((p) => (
                <Link key={p.pathId} href={`/paths/${p.pathId}`} className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-card px-3 text-sm hover:bg-accent">
                  <Route className="size-4 text-primary" /> {p.path.title}
                </Link>
              ))}
            </section>
          ) : null}

          {book.description ? (
            <section>
              <SectionTitle>内容紹介</SectionTitle>
              <ReadMore as="p" className="prose-note text-[15px] leading-relaxed text-foreground/85">
                {book.description}
              </ReadMore>
            </section>
          ) : null}

          <section>
            <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 rounded-xl bg-muted/50 p-4 text-sm">
              {meta.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="break-all">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}

function BookHeading({ book }: { book: NonNullable<Awaited<ReturnType<typeof getBookDetail>>> }) {
  return (
    <div className="space-y-2">
      <h2 className="text-xl leading-snug font-bold md:text-2xl">{book.title}</h2>
      {book.subtitle ? <p className="text-sm text-muted-foreground">{book.subtitle}</p> : null}
      <p className="flex flex-wrap gap-x-2 text-[15px]">
        {book.authors.length ? (
          book.authors.map((a) => (
            <Link key={a.authorId} href={`/authors/${a.authorId}`} className="text-primary hover:underline">
              {a.author.name}
            </Link>
          ))
        ) : (
          <span className="text-muted-foreground">著者不明</span>
        )}
      </p>
      {book.series ? (
        <p className="text-sm">
          <Link href={`/series/${book.series.id}`} className="text-muted-foreground hover:underline">
            {book.series.title}
            {book.seriesNumber != null ? ` ${book.seriesNumber}巻` : ""}
          </Link>
        </p>
      ) : null}
      <RatingStars value={book.rating} size="md" />
    </div>
  );
}
