import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { SectionTitle } from "@/components/books/bits";
import { ensureTodayNews, listTodayNews, type TodayNewsItem } from "@/server/services/news";
import { NewsSaveButton } from "./news-client";

/** 日本時間の時刻（今日なら「9:30」、それ以外は「10/7」） */
function when(d: Date | null, now = new Date()) {
  if (!d) return null;
  const jst = (x: Date) => new Date(x.getTime() + 9 * 3600_000);
  const a = jst(d);
  const b = jst(now);
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10) ? `${a.getUTCHours()}:${String(a.getUTCMinutes()).padStart(2, "0")}` : `${a.getUTCMonth() + 1}/${a.getUTCDate()}`;
}

const FEED_LABEL: Record<string, string> = { top: "主要", business: "経済", knowledge: "知識に関係" };

export function NewsList({ items, showDay = false }: { items: TodayNewsItem[]; showDay?: boolean }) {
  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
      {items.map((n) => {
        const linked = n.knowledge.map((l) => l.knowledge);
        return (
          <li key={n.id} className="flex items-start gap-1 py-1 pr-1 pl-4">
            <div className="min-w-0 flex-1 py-2">
              <a href={n.url} target="_blank" rel="noopener noreferrer" className="group block">
                <span className="line-clamp-2 text-[15px] leading-snug font-medium group-hover:underline">{n.title}</span>
                <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="min-w-0 truncate">
                    {[FEED_LABEL[n.feed] ?? n.feed, n.source, showDay ? n.day.slice(5).replace("-", "/") : when(n.publishedAt)].filter(Boolean).join("・")}
                  </span>
                  <ExternalLink className="size-3 shrink-0" aria-hidden />
                </span>
              </a>
              {linked.length || n.candidates.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {linked.map((k) => (
                    <Link key={k.id} href={`/knowledge/${k.id}`} className="inline-flex h-7 items-center rounded-full bg-primary/10 px-2.5 text-xs text-primary">
                      🧠 {k.title}
                    </Link>
                  ))}
                  {n.candidates.map((k) => (
                    <span key={k.id} className="inline-flex h-7 items-center rounded-full border border-dashed px-2.5 text-xs text-muted-foreground" title="見出しから見つけた、関係しそうな知識">
                      🧠 {k.title}？
                    </span>
                  ))}
                </div>
              ) : null}
              {n.memo ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">📝 {n.memo}</p> : null}
            </div>
            <NewsSaveButton
              news={{ id: n.id, title: n.title, saved: !!n.savedAt, memo: n.memo, keyword: n.keyword, linked, candidates: n.candidates }}
            />
          </li>
        );
      })}
    </ul>
  );
}

/** ホーム：本日のニュース（その日はじめて開いたときに集める） */
export async function TodayNewsSection() {
  try {
    // E2E テストなどでは外部のニュースを取りに行かない
    if (process.env.NEWS_DISABLED !== "1") await ensureTodayNews(prisma);
  } catch {
    // 集められなくてもホームは表示する
  }
  const items = await listTodayNews(prisma).catch(() => []);
  return (
    <section aria-labelledby="h-news">
      <SectionTitle action={<Link href="/news" className="text-sm text-primary">保存したニュース</Link>}>
        <span id="h-news">📰 本日のニュース</span>
      </SectionTitle>
      {items.length ? (
        <>
          <NewsList items={items} />
          <p className="mt-2 text-xs text-muted-foreground">見出しとリンクは Yahoo!ニュース・Google ニュースから。🔖 で保存すると知識につなげられます。</p>
        </>
      ) : (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">今日のニュースを取得できませんでした。しばらくしてから開き直してください。</p>
      )}
    </section>
  );
}

export function TodayNewsSkeleton() {
  return (
    <section aria-label="本日のニュースを読み込み中">
      <SectionTitle>📰 本日のニュース</SectionTitle>
      <div className="space-y-2 rounded-2xl border bg-card p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </section>
  );
}
