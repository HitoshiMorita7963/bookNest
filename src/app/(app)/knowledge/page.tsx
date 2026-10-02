import Link from "next/link";
import { ChevronRight, Network, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { knowledgeFacets, listKnowledge } from "@/server/services/knowledge";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBox } from "@/components/search/search-box";
import { EmptyState, TagChip } from "@/components/books/bits";
import { Button } from "@/components/ui/button";
import { truncate } from "@/lib/utils";
import { ChipLink } from "@/components/ui/chip-link";
import { RenameCategoryButton } from "@/components/knowledge/category-rename";
import { SuggestUncategorizedButton } from "@/components/knowledge/category-suggest";

export const metadata = { title: "知識" };

type SP = { q?: string; tag?: string; category?: string };

function href(sp: SP, patch: Partial<SP>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
  const qs = p.toString();
  return qs ? `/knowledge?${qs}` : "/knowledge";
}

type Note = Awaited<ReturnType<typeof listKnowledge>>[number];

/** カテゴリごとにまとめる（件数の多い順・未分類は最後） */
function groupByCategory(notes: Note[]) {
  const map = new Map<string | null, Note[]>();
  for (const n of notes) {
    const key = n.category?.trim() || null;
    map.set(key, [...(map.get(key) ?? []), n]);
  }
  return [...map.entries()]
    .sort(([a, x], [b, y]) => (a === null ? 1 : b === null ? -1 : y.length - x.length || a.localeCompare(b, "ja")))
    .map(([category, list]) => ({
      category,
      name: category ?? "未分類",
      notes: list,
      links: list.reduce((s, n) => s + n._count.linksFrom + n._count.linksTo, 0),
    }));
}

function KnowledgeCard({ n, sp }: { n: Note; sp: SP }) {
  return (
    <li className="relative rounded-2xl border bg-card p-4 hover:bg-accent/30">
      <Link href={`/knowledge/${n.id}`} className="absolute inset-0 rounded-2xl" aria-label={n.title} />
      <p className="font-semibold">🧠 {n.title}</p>
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
        {n._count.linksFrom + n._count.linksTo ? <span className="text-xs text-muted-foreground">🔗 {n._count.linksFrom + n._count.linksTo}</span> : null}
        {n._count.quotes ? <span className="text-xs text-muted-foreground">💬 {n._count.quotes}</span> : null}
      </div>
    </li>
  );
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
              <ChipLink href={href(sp, { category: undefined })} active={!sp.category}>
                すべて
              </ChipLink>
              {facets.categories.map((c) => (
                <ChipLink key={c.name} href={href(sp, { category: sp.category === c.name ? undefined : c.name })} active={sp.category === c.name}>
                  {c.name}
                  <span className="text-xs opacity-70">{c.count}</span>
                </ChipLink>
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
            <div className="space-y-3">
              {groupByCategory(notes).map((g) => (
                <details key={g.name} open className="group rounded-2xl border bg-muted/30 p-2 md:p-3">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-2 [&::-webkit-details-marker]:hidden">
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                    <h2 className="font-semibold">{g.name}</h2>
                    <span className="text-sm text-muted-foreground">{g.notes.length}件</span>
                    {g.links ? <span className="text-xs text-muted-foreground">・ つながり {g.links}</span> : null}
                    <span className="ml-auto flex items-center gap-1">
                      {g.category && !sp.category ? (
                        <Link href={href(sp, { category: g.category })} className="text-xs text-primary hover:underline">
                          このカテゴリだけ
                        </Link>
                      ) : null}
                      {!g.category ? <SuggestUncategorizedButton /> : null}
                      {/* 検索などで絞り込んでいても、変更はそのカテゴリの知識すべてが対象 */}
                      <RenameCategoryButton
                        category={g.category}
                        count={g.category ? (facets.categories.find((c) => c.name === g.category)?.count ?? g.notes.length) : total - facets.categories.reduce((n, c) => n + c.count, 0)}
                        categories={facets.categories}
                      />
                    </span>
                  </summary>
                  <ul className="mt-2 grid gap-3 md:grid-cols-2">
                    {g.notes.map((n) => (
                      <KnowledgeCard key={n.id} n={n} sp={sp} />
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

