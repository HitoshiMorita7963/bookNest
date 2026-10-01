import Link from "next/link";
import { Network, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { knowledgeFacets, listKnowledge } from "@/server/services/knowledge";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBox } from "@/components/search/search-box";
import { EmptyState, TagChip } from "@/components/books/bits";
import { Button } from "@/components/ui/button";
import { cn, truncate } from "@/lib/utils";

export const metadata = { title: "知識" };

type SP = { q?: string; tag?: string; category?: string };

function href(sp: SP, patch: Partial<SP>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
  const qs = p.toString();
  return qs ? `/knowledge?${qs}` : "/knowledge";
}

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [notes, facets, total] = await Promise.all([
    listKnowledge(prisma, { q: sp.q?.slice(0, 100), tag: sp.tag, category: sp.category }),
    knowledgeFacets(prisma),
    prisma.knowledgeNote.count(),
  ]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="知識"
        subtitle={`${total}件`}
        actions={
          <>
            <Button asChild variant="ghost" size="icon" aria-label="知識マップ">
              <Link href="/knowledge/map">
                <Network className="size-5" />
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/knowledge/new">
                <Plus /> 追加
              </Link>
            </Button>
          </>
        }
      />
      {total === 0 ? (
        <EmptyState
          icon="🧠"
          title="まだ知識ノートがありません"
          description="本を読んで得た知識・理解を、自分の言葉でまとめておきましょう。フレーズ（本の言葉）とは別に、自分の理解として蓄積されます。"
          action={
            <Button asChild size="lg">
              <Link href="/knowledge/new">
                <Plus /> 知識ノートを作る
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <SearchBox initial={sp.q ?? ""} placeholder="知識・タグ・本で検索" autoFocus={false} />
          {facets.categories.length ? (
            <nav className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" aria-label="カテゴリ">
              <Link href={href(sp, { category: undefined })} className={chip(!sp.category)}>
                すべて
              </Link>
              {facets.categories.map((c) => (
                <Link key={c.name} href={href(sp, { category: sp.category === c.name ? undefined : c.name })} className={chip(sp.category === c.name)}>
                  {c.name}
                  <span className="text-xs opacity-70">{c.count}</span>
                </Link>
              ))}
            </nav>
          ) : null}
          {sp.tag ? (
            <p className="text-sm">
              #{sp.tag} の知識{" "}
              <Link href={href(sp, { tag: undefined })} className="text-primary underline">
                解除
              </Link>
            </p>
          ) : null}
          {notes.length === 0 ? (
            <EmptyState icon="🔍" title="該当する知識はありません" />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {notes.map((n) => (
                <li key={n.id} className="relative rounded-2xl border bg-card p-4 hover:bg-accent/30">
                  <Link href={`/knowledge/${n.id}`} className="absolute inset-0 rounded-2xl" aria-label={n.title} />
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">🧠 {n.title}</p>
                    {n.category ? <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs">{n.category}</span> : null}
                  </div>
                  {n.content ? <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">{n.content}</p> : null}
                  {n.books.length ? (
                    <p className="mt-2 line-clamp-1 text-xs text-foreground/70">
                      📖 {n.books.map((b) => `『${truncate(b.book.title, 16)}』`).join(" ")}
                    </p>
                  ) : null}
                  <div className="relative z-10 mt-2 flex flex-wrap items-center gap-1.5">
                    {n.tags.map((t) => (
                      <TagChip key={t.tagId} name={t.tag.name} href={href(sp, { tag: t.tag.name })} />
                    ))}
                    {n._count.linksFrom + n._count.linksTo ? (
                      <span className="text-xs text-muted-foreground">🔗 {n._count.linksFrom + n._count.linksTo}</span>
                    ) : null}
                    {n._count.quotes ? <span className="text-xs text-muted-foreground">💬 {n._count.quotes}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function chip(active: boolean) {
  return cn("flex h-9 shrink-0 items-center gap-1 rounded-full border px-3.5 text-sm", active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent");
}
