import Link from "next/link";
import { format } from "date-fns";
import { Heart } from "lucide-react";
import { TagChip } from "@/components/books/bits";
import { QuoteCardMenu } from "./quote-menu";

export interface QuoteCardData {
  id: string;
  text: string;
  pageNumber: string | null;
  note: string | null;
  isFavorite: boolean;
  createdAt: Date;
  tags: { tag: { name: string } }[];
  book: { id: string; title: string; authors?: { author: { name: string } }[] } | null;
}

function pageLabel(p: string) {
  return /^\d+(-\d+)?$/.test(p) ? `p.${p}` : p;
}

export function QuoteCard({ quote, highlight }: { quote: QuoteCardData; highlight?: string }) {
  return (
    <article className="relative rounded-2xl border bg-card p-4 md:p-5">
      <Link href={`/quotes/${quote.id}`} className="absolute inset-0 rounded-2xl" aria-label="フレーズの詳細を開く" />
      <div className="absolute top-2 right-2 z-10">
        <QuoteCardMenu id={quote.id} />
      </div>
      <blockquote className="quote-text relative border-l-2 border-highlight pr-8 pl-3 text-[16px]">
        「{highlight ? <Highlighted text={quote.text} q={highlight} /> : quote.text}」
      </blockquote>
      <div className="relative mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        {quote.book ? (
          <Link href={`/books/${quote.book.id}`} className="relative z-10 font-medium text-foreground/80 hover:underline">
            『{quote.book.title}』
          </Link>
        ) : null}
        {quote.book?.authors?.length ? <span>{quote.book.authors.map((a) => a.author.name).join("、")}</span> : null}
        {quote.pageNumber ? <span className="tabular-nums">{pageLabel(quote.pageNumber)}</span> : null}
        {quote.isFavorite ? <Heart className="size-4 fill-rose-500 text-rose-500" aria-label="お気に入り" /> : null}
        <span className="ml-auto text-xs">{format(quote.createdAt, "yyyy/M/d")}</span>
      </div>
      {quote.tags.length ? (
        <div className="relative z-10 mt-2 flex flex-wrap gap-1.5">
          {quote.tags.map((t) => (
            <TagChip key={t.tag.name} name={t.tag.name} href={`/quotes?tag=${encodeURIComponent(t.tag.name)}`} />
          ))}
        </div>
      ) : null}
      {quote.note ? (
        <div className="relative mt-3 rounded-xl bg-muted/60 p-3 text-sm">
          <p className="text-xs font-medium text-muted-foreground">自分のメモ</p>
          <p className="prose-note mt-0.5 line-clamp-4">{quote.note}</p>
        </div>
      ) : null}
    </article>
  );
}

function Highlighted({ text, q }: { text: string; q: string }) {
  const term = q.trim();
  if (!term) return <>{text}</>;
  const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === term.toLowerCase() ? (
          <mark key={i} className="rounded bg-highlight/40 px-0.5 text-inherit">
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  );
}
