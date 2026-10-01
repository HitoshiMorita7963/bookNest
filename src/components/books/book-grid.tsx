import Link from "next/link";
import { BookCover } from "./book-cover";
import { RatingStars, StatusBadge, authorNames } from "./bits";
import { progressPercent, cn } from "@/lib/utils";

export interface BookCardData {
  id: string;
  title: string;
  coverImage: string | null;
  status: string;
  rating: number | null;
  pageCount: number | null;
  currentPage: number;
  publisher?: string | null;
  authors: { author: { name: string } }[];
}

export function BookGrid({ books, className }: { books: BookCardData[]; className?: string }) {
  return (
    <ul
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-6 min-[400px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8",
        className,
      )}
    >
      {books.map((b, i) => (
        <li key={b.id}>
          <Link href={`/books/${b.id}`} className="group block rounded-lg focus-visible:outline-offset-4">
            <div className="transition-transform duration-200 group-hover:-translate-y-0.5">
              <BookCover src={b.coverImage} title={b.title} author={authorNames(b, 1)} priority={i < 6} />
            </div>
            {b.status === "READING" && b.pageCount ? (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-label={`進捗 ${progressPercent(b.currentPage, b.pageCount)}%`}>
                <div className="h-full bg-primary" style={{ width: `${progressPercent(b.currentPage, b.pageCount)}%` }} />
              </div>
            ) : null}
            <p className="mt-2 line-clamp-2 text-sm leading-snug font-medium">{b.title}</p>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{authorNames(b, 2) || "著者不明"}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={b.status} />
              <RatingStars value={b.rating} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function BookList({ books }: { books: BookCardData[] }) {
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {books.map((b) => (
        <li key={b.id}>
          <Link href={`/books/${b.id}`} className="flex gap-3 p-3 hover:bg-accent/50 active:bg-accent/60">
            <div className="w-14 shrink-0">
              <BookCover src={b.coverImage} title={b.title} size="xs" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[15px] leading-snug font-medium">{b.title}</p>
              <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                {authorNames(b) || "著者不明"}
                {b.publisher ? ` ・ ${b.publisher}` : ""}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <StatusBadge status={b.status} />
                <RatingStars value={b.rating} />
                {b.pageCount ? <span className="text-xs text-muted-foreground">{b.pageCount}p</span> : null}
                {b.status === "READING" && b.pageCount ? (
                  <span className="text-xs font-medium text-primary">{progressPercent(b.currentPage, b.pageCount)}%</span>
                ) : null}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** ホーム等の横スクロール本棚 */
export function BookRow({ books }: { books: BookCardData[] }) {
  return (
    <ul className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      {books.map((b) => (
        <li key={b.id} className="w-[104px] shrink-0 snap-start md:w-28">
          <Link href={`/books/${b.id}`} className="block">
            <BookCover src={b.coverImage} title={b.title} size="sm" author={authorNames(b, 1)} />
            <p className="mt-1.5 line-clamp-2 text-xs leading-snug font-medium">{b.title}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
