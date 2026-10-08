import Link from "next/link";
import { format } from "date-fns";
import { Heart } from "lucide-react";
import { TagChip } from "@/components/books/bits";
import { QuoteCardMenu } from "./quote-menu";
import { ReadMore } from "@/components/ui/read-more";
import { QUOTE_CLOSE, QUOTE_OPEN } from "@/lib/quote-marks";

export interface QuoteCardData {
  id: string;
  text: string;
  pageNumber: string | null;
  note: string | null;
  isFavorite: boolean;
  createdAt: Date;
  tags: { tag: { name: string } }[];
  book: { id: string; title: string; authors?: { author: { name: string } }[] } | null;
  /** つながっている知識（読み込んでいる画面だけ表示する） */
  knowledge?: { knowledge: { id: string; title: string } }[];
}

function pageLabel(p: string) {
  return /^\d+(-\d+)?$/.test(p) ? `p.${p}` : p;
}

export function QuoteCard({ quote, highlight, hideKnowledgeId }: { quote: QuoteCardData; highlight?: string; hideKnowledgeId?: string }) {
  const knowledge = (quote.knowledge ?? []).map((k) => k.knowledge).filter((k) => k.id !== hideKnowledgeId);
  return (
    <article className="relative rounded-2xl border bg-card p-4 md:p-5">
      <Link href={`/quotes/${quote.id}`} className="absolute inset-0 rounded-2xl" aria-label="フレーズの詳細を開く" />
      <div className="absolute top-2 right-2 z-10">
        <QuoteCardMenu id={quote.id} />
      </div>
      <div className="relative border-l-2 border-highlight pr-8 pl-3">
        <ReadMore as="blockquote" className="quote-text text-[16px]">
          {QUOTE_OPEN}
          {highlight ? <Highlighted text={quote.text} q={highlight} /> : quote.text}
          {QUOTE_CLOSE}
        </ReadMore>
      </div>
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
      {knowledge.length ? (
        <ul className="relative z-10 mt-2 flex flex-wrap gap-1.5" aria-label="つながっている知識">
          {knowledge.map((k) => (
            <li key={k.id}>
              <Link href={`/knowledge/${k.id}`} className="inline-flex min-h-7 items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary hover:bg-primary/15">
                🧠 {k.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {quote.note ? (
        <div className="relative mt-3 rounded-xl bg-muted/60 p-3 text-sm">
          <p className="text-xs font-medium text-muted-foreground">自分のメモ</p>
          <ReadMore as="p" className="prose-note mt-0.5">
            {quote.note}
          </ReadMore>
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
