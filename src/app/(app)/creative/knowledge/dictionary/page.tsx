import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/books/bits";
import { ChipLink } from "@/components/ui/chip-link";
import { CkCategoryBadge } from "@/components/creative-knowledge/ck-bits";
import { KANA_ROWS, kanaRow, lines, type KanaRow } from "@/lib/creative-knowledge";

export const metadata = { title: "物語要素事典" };

const ROW_ORDER: KanaRow[] = [...KANA_ROWS, "英数", "他"];
const rowLabel = (r: KanaRow) => (r === "英数" || r === "他" ? r : `${r}行`);

/** 物語要素事典：創作知識を五十音順に引く */
export default async function StoryDictionaryPage({ searchParams }: { searchParams: Promise<{ row?: string }> }) {
  const { row } = await searchParams;
  const selected = ROW_ORDER.includes(row as KanaRow) ? (row as KanaRow) : null;
  const items = await prisma.creativeKnowledge.findMany({ select: { id: true, title: true, reading: true, summary: true, category: true, examples: true } });
  const collator = new Intl.Collator("ja");
  const entries = items
    .map((k) => ({ ...k, row: kanaRow(k.reading), exampleCount: lines(k.examples).length }))
    .sort((a, b) => collator.compare(a.reading || a.title, b.reading || b.title));
  const counts = new Map<KanaRow, number>();
  for (const e of entries) counts.set(e.row, (counts.get(e.row) ?? 0) + 1);
  const rows = ROW_ORDER.filter((r) => counts.get(r)).filter((r) => !selected || r === selected);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="📖 物語要素事典" subtitle={`${entries.length}項目`} back="/creative/knowledge" />
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">物語の型・人物・感情・演出・モチーフなどの要素を五十音順に引けます。各項目には定義と作品例、関連する項目がまとまっています。</p>
        <nav className="flex flex-wrap gap-1.5" aria-label="五十音">
          <ChipLink href="/creative/knowledge/dictionary" active={!selected} className="h-9 min-w-11 justify-center px-3">
            すべて
          </ChipLink>
          {ROW_ORDER.map((r) =>
            counts.get(r) ? (
              <ChipLink key={r} href={`/creative/knowledge/dictionary?row=${encodeURIComponent(r)}`} active={selected === r} className="h-9 min-w-11 justify-center px-3">
                {r}
              </ChipLink>
            ) : (
              <span key={r} className="inline-flex h-9 min-w-11 items-center justify-center rounded-full border border-dashed px-3 text-sm text-muted-foreground/50" aria-hidden>
                {r}
              </span>
            ),
          )}
        </nav>

        {entries.length === 0 ? (
          <EmptyState icon="📖" title="まだ項目がありません" description="創作知識のトップの「基本の創作知識」を読み込むと、事典として引けるようになります。" />
        ) : (
          rows.map((r) => (
            <section key={r} aria-label={rowLabel(r)}>
              <h2 className="sticky top-14 z-10 -mx-4 mb-2 bg-background/95 px-4 py-1.5 text-sm font-semibold text-primary backdrop-blur lg:top-0">
                {rowLabel(r)} <span className="font-normal text-muted-foreground">{counts.get(r)}</span>
              </h2>
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                {entries
                  .filter((e) => e.row === r)
                  .map((e) => (
                    <li key={e.id}>
                      <Link href={`/creative/knowledge/${e.id}`} className="block px-4 py-3 hover:bg-accent/40">
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-semibold">{e.title}</span>
                          {e.reading ? <span className="text-xs text-muted-foreground">{e.reading}</span> : null}
                          <CkCategoryBadge category={e.category} className="ml-auto" />
                        </span>
                        {e.summary ? <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{e.summary}</span> : null}
                        {e.exampleCount ? <span className="mt-1 block text-xs text-muted-foreground">📚 作品例 {e.exampleCount}</span> : null}
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
