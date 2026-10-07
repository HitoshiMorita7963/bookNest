import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { ckCategoryCounts, listCreativeKnowledge } from "@/server/services/creative-knowledge";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBox } from "@/components/search/search-box";
import { EmptyState, SectionTitle } from "@/components/books/bits";
import { ChipLink } from "@/components/ui/chip-link";
import { Button } from "@/components/ui/button";
import { CkCard } from "@/components/creative-knowledge/ck-bits";
import { CK_CATEGORIES, CK_CATEGORY_INFO, isCkCategory } from "@/lib/creative-knowledge";

export const metadata = { title: "創作知識" };

type SP = { q?: string; category?: string; tag?: string };
function href(sp: SP, patch: Partial<SP>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
  const qs = p.toString();
  return qs ? `/creative/knowledge?${qs}` : "/creative/knowledge";
}

export default async function CreativeKnowledgePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const category = isCkCategory(sp.category) ? sp.category : undefined;
  const filtered = !!(category || sp.tag || sp.q?.trim());
  const [counts, total, items, recent] = await Promise.all([
    ckCategoryCounts(prisma),
    prisma.creativeKnowledge.count(),
    filtered ? listCreativeKnowledge(prisma, { category, tag: sp.tag, q: sp.q?.slice(0, 100) }) : Promise.resolve([]),
    filtered ? Promise.resolve([]) : prisma.creativeKnowledge.findMany({ include: { categories: { select: { category: true } }, tags: { include: { tag: { select: { name: true } } } } }, orderBy: { updatedAt: "desc" }, take: 8 }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="🧠 創作知識"
        subtitle={`${total}件`}
        back={filtered ? "/creative/knowledge" : "/creative"}
        actions={
          <Button asChild size="sm">
            <Link href={`/creative/knowledge/new${category ? `?category=${category}` : ""}`}>
              <Plus /> 追加
            </Link>
          </Button>
        }
      />
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">物語の型・人物・感情・演出などの「創作の知識」を、読書で出会った具体例や自分の作品とつなげて蓄えます。</p>
        <SearchBox initial={sp.q ?? ""} placeholder="知識・別名・タグで検索（例：敵が仲間になる）" autoFocus={false} />

        {filtered ? (
          <>
            <nav className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" aria-label="カテゴリ">
              <ChipLink href={href(sp, { category: undefined })} active={!category}>
                すべて
              </ChipLink>
              {CK_CATEGORIES.map((c) => (
                <ChipLink key={c} href={href(sp, { category: category === c ? undefined : c })} active={category === c}>
                  {CK_CATEGORY_INFO[c].emoji} {CK_CATEGORY_INFO[c].label}
                  <span className="text-xs opacity-70">{counts[c]}</span>
                </ChipLink>
              ))}
            </nav>
            {sp.tag ? (
              <p className="text-sm">
                #{sp.tag} の創作知識{" "}
                <Link href={href(sp, { tag: undefined })} className="text-primary underline">
                  解除
                </Link>
              </p>
            ) : null}
            {category ? <p className="text-sm text-muted-foreground">{CK_CATEGORY_INFO[category].description}</p> : null}
            {items.length ? (
              <>
                <p className="text-sm text-muted-foreground">{items.length}件</p>
                <ul className="grid gap-3 md:grid-cols-2">
                  {items.map((k) => (
                    <CkCard key={k.id} k={k} tagHref={(t) => href({}, { tag: t })} />
                  ))}
                </ul>
              </>
            ) : (
              <EmptyState
                icon="🔍"
                title="該当する創作知識はありません"
                action={
                  <Button asChild>
                    <Link href={`/creative/knowledge/new${category ? `?category=${category}` : ""}`}>
                      <Plus /> 創作知識を追加
                    </Link>
                  </Button>
                }
              />
            )}
          </>
        ) : (
          <>
            <section aria-label="カテゴリ">
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {CK_CATEGORIES.map((c) => {
                  const info = CK_CATEGORY_INFO[c];
                  return (
                    <li key={c}>
                      <Link href={`/creative/knowledge?category=${c}`} className="flex h-full flex-col gap-1 rounded-2xl border bg-card p-3 hover:bg-accent/40">
                        <span className="text-xl" aria-hidden>
                          {info.emoji}
                        </span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">{info.no}</span>
                        <span className="font-semibold leading-tight">{info.label}</span>
                        <span className="text-xs text-muted-foreground">{counts[c]}件</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
            {total === 0 ? (
              <EmptyState
                icon="🧠"
                title="まだ創作知識がありません"
                description="「敵から味方へ」「伏線回収」のような創作の知識を登録して、読書メモや自分の作品とつなげましょう。"
                action={
                  <Button asChild size="lg">
                    <Link href="/creative/knowledge/new">
                      <Plus /> 創作知識を追加
                    </Link>
                  </Button>
                }
              />
            ) : (
              <section>
                <SectionTitle>最近更新した創作知識</SectionTitle>
                <ul className="grid gap-3 md:grid-cols-2">
                  {recent.map((k) => (
                    <CkCard key={k.id} k={k} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
