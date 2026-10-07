import Link from "next/link";
import { Plus, Star } from "lucide-react";
import { prisma } from "@/lib/db";
import { ckCategoryCounts, ckSubCategories, ckTags, listCreativeKnowledge, type CkListItem } from "@/server/services/creative-knowledge";
import { searchCreativeKnowledge } from "@/server/services/creative-knowledge-search";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBox } from "@/components/search/search-box";
import { EmptyState, SectionTitle } from "@/components/books/bits";
import { ChipLink } from "@/components/ui/chip-link";
import { Button } from "@/components/ui/button";
import { CkCard } from "@/components/creative-knowledge/ck-bits";
import { CkSeedCard } from "@/components/creative-knowledge/ck-seed";
import { ckSeedStatus } from "@/server/services/creative-knowledge-seed";
import { CK_CATEGORIES, CK_CATEGORY_INFO, isCkCategory, type CkCategory } from "@/lib/creative-knowledge";

export const metadata = { title: "創作知識" };

type SP = { q?: string; category?: string; sub?: string; tag?: string; fav?: string };
function href(sp: SP, patch: Partial<SP>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
  const qs = p.toString();
  return qs ? `/creative/knowledge?${qs}` : "/creative/knowledge";
}

const NO_SUB = "（サブカテゴリなし）";
const OTHER_PRIMARY = "ほかのカテゴリの知識";

/** カテゴリ表示のとき：サブカテゴリごとにまとめる（候補の順 → それ以外 → なし → ほかのカテゴリが主の知識） */
function groupBySub(items: CkListItem[], category: CkCategory) {
  const order = CK_CATEGORY_INFO[category].subCategories;
  const groups = new Map<string, CkListItem[]>();
  for (const k of items) {
    const key = k.category !== category ? OTHER_PRIMARY : (k.subCategory ?? NO_SUB);
    groups.set(key, [...(groups.get(key) ?? []), k]);
  }
  const rank = (name: string) => (name === OTHER_PRIMARY ? 3000 : name === NO_SUB ? 2000 : order.includes(name) ? order.indexOf(name) : 1000);
  return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, "ja"));
}

export default async function CreativeKnowledgePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const category = isCkCategory(sp.category) ? sp.category : undefined;
  const query = sp.q?.trim().slice(0, 100) ?? "";
  const favorite = sp.fav === "1";
  const filtered = !!(category || sp.tag || query || favorite);
  // 検索語があるときは、言い換えや関連知識も拾う採点つきの検索
  const hits = query ? (await searchCreativeKnowledge(prisma, query, { category, tag: sp.tag })).filter((h) => !favorite || h.item.isFavorite) : [];
  const [counts, total, tags, subs, items, recent, favorites, seedStatus] = await Promise.all([
    ckCategoryCounts(prisma),
    prisma.creativeKnowledge.count(),
    ckTags(prisma),
    category ? ckSubCategories(prisma, category) : Promise.resolve([]),
    filtered && !query ? listCreativeKnowledge(prisma, { category, sub: sp.sub?.slice(0, 60), tag: sp.tag, favorite }) : Promise.resolve([]),
    filtered ? Promise.resolve([]) : prisma.creativeKnowledge.findMany({ include: { categories: { select: { category: true } }, tags: { include: { tag: { select: { name: true } } } } }, orderBy: { updatedAt: "desc" }, take: 8 }),
    filtered ? Promise.resolve([]) : listCreativeKnowledge(prisma, { favorite: true }),
    filtered ? Promise.resolve(null) : ckSeedStatus(prisma),
  ]);
  const grouped = category && !sp.sub && !sp.tag && !query && !favorite ? groupBySub(items, category) : null;
  const shown = query ? hits.map((h) => ({ k: h.item, note: h.via ? `🔗 ${h.reason}` : h.reason })) : items.map((k) => ({ k, note: undefined as string | undefined }));
  const newHref = `/creative/knowledge/new${category ? `?category=${category}` : ""}`;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="🧠 創作知識"
        subtitle={`${total}件`}
        back={filtered ? "/creative/knowledge" : "/creative"}
        actions={
          <Button asChild size="sm">
            <Link href={newHref}>
              <Plus /> 追加
            </Link>
          </Button>
        }
      />
      <div className="space-y-5">
        {!filtered ? <p className="text-sm text-muted-foreground">物語の型・人物・感情・演出などの「創作の知識」を、読書で出会った具体例や自分の作品とつなげて蓄えます。</p> : null}
        <SearchBox initial={sp.q ?? ""} placeholder="知識・別名・タグで検索（例：敵が仲間になる）" autoFocus={false} />

        {filtered ? (
          <>
            <nav className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" aria-label="カテゴリ">
              <ChipLink href={href(sp, { category: undefined, sub: undefined, fav: undefined })} active={!category && !favorite}>
                すべて
              </ChipLink>
              <ChipLink href={href(sp, { fav: favorite ? undefined : "1" })} active={favorite}>
                <Star className="size-3.5" /> お気に入り
              </ChipLink>
              {CK_CATEGORIES.map((c) => (
                <ChipLink key={c} href={href(sp, { category: category === c ? undefined : c, sub: undefined })} active={category === c}>
                  {CK_CATEGORY_INFO[c].emoji} {CK_CATEGORY_INFO[c].label}
                  <span className="text-xs opacity-70">{counts[c]}</span>
                </ChipLink>
              ))}
            </nav>
            {category ? (
              <div className="space-y-2">
                <h2 className="text-lg font-bold">
                  {CK_CATEGORY_INFO[category].emoji} {CK_CATEGORY_INFO[category].no} {CK_CATEGORY_INFO[category].label}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">{CK_CATEGORY_INFO[category].description}</span>
                </h2>
                {subs.length ? (
                  <nav className="flex flex-wrap gap-2" aria-label="サブカテゴリ">
                    {subs.map((s) => (
                      <ChipLink key={s.name} href={href(sp, { sub: sp.sub === s.name ? undefined : s.name })} active={sp.sub === s.name} className="h-8 px-3 text-xs">
                        {s.name}
                        <span className="opacity-70">{s.count}</span>
                      </ChipLink>
                    ))}
                  </nav>
                ) : null}
              </div>
            ) : null}
            {sp.tag ? (
              <p className="text-sm">
                <span className="font-semibold">#{sp.tag}</span> の創作知識{" "}
                <Link href={href(sp, { tag: undefined })} className="text-primary underline">
                  解除
                </Link>
              </p>
            ) : null}
            {shown.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="該当する創作知識はありません"
                action={
                  <Button asChild>
                    <Link href={newHref}>
                      <Plus /> 創作知識を追加
                    </Link>
                  </Button>
                }
              />
            ) : grouped ? (
              <div className="space-y-6">
                {grouped.map(([name, list]) => (
                  <section key={name}>
                    <SectionTitle>
                      {name} <span className="text-sm font-normal text-muted-foreground">{list.length}件</span>
                    </SectionTitle>
                    <ul className="grid gap-3 md:grid-cols-2">
                      {list.map((k) => (
                        <CkCard key={k.id} k={k} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {shown.length}件{query ? "（関連の強い順）" : ""}
                </p>
                <ul className="grid gap-3 md:grid-cols-2">
                  {shown.map(({ k, note }) => (
                    <CkCard key={k.id} k={k} note={note} />
                  ))}
                </ul>
              </>
            )}
          </>
        ) : (
          <>
            {seedStatus ? <CkSeedCard status={seedStatus} /> : null}
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
            {favorites.length ? (
              <section>
                <SectionTitle action={<Link href="/creative/knowledge?fav=1" className="text-sm text-primary">すべて</Link>}>
                  ★ お気に入り <span className="text-sm font-normal text-muted-foreground">今後の創作で使いたい知識</span>
                </SectionTitle>
                <ul className="grid gap-3 md:grid-cols-2">
                  {favorites.slice(0, 6).map((k) => (
                    <CkCard key={k.id} k={k} />
                  ))}
                </ul>
              </section>
            ) : null}
            {tags.length ? (
              <section>
                <SectionTitle>🏷 タグから探す</SectionTitle>
                <nav className="flex flex-wrap gap-2" aria-label="タグ">
                  {tags.slice(0, 40).map((t) => (
                    <ChipLink key={t.name} href={href({}, { tag: t.name })} active={false} className="h-8 px-3 text-xs">
                      #{t.name}
                      <span className="opacity-70">{t.count}</span>
                    </ChipLink>
                  ))}
                </nav>
              </section>
            ) : null}
            {total === 0 ? (
              <EmptyState
                icon="🧠"
                title="まだ創作知識がありません"
                description="「敵から味方へ」「伏線回収」のような創作の知識を登録して、読書メモや自分の作品とつなげましょう。上の「基本の創作知識」から始めることもできます。"
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
