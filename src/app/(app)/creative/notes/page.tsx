import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { listCreativeNotes } from "@/server/services/creative";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBox } from "@/components/search/search-box";
import { EmptyState } from "@/components/books/bits";
import { ChipLink } from "@/components/ui/chip-link";
import { Button } from "@/components/ui/button";
import { CreativeNoteCard } from "@/components/creative/note-card";
import { CREATIVE_CATEGORIES, CREATIVE_CATEGORY_EMOJI, CREATIVE_CATEGORY_LABEL, NOTE_STATUSES, NOTE_STATUS_LABEL } from "@/lib/constants";

export const metadata = { title: "創作メモ" };

type SP = { q?: string; category?: string; status?: string };
function href(sp: SP, patch: Partial<SP>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
  const qs = p.toString();
  return qs ? `/creative/notes?${qs}` : "/creative/notes";
}

export default async function CreativeNotesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const category = sp.category && (CREATIVE_CATEGORIES as readonly string[]).includes(sp.category) ? sp.category : undefined;
  const status = sp.status && (NOTE_STATUSES as readonly string[]).includes(sp.status) ? sp.status : undefined;
  const [{ items, total }, all] = await Promise.all([listCreativeNotes(prisma, { q: sp.q?.slice(0, 100), category, status }), prisma.creativeNote.count()]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="💡 創作メモ"
        subtitle={`${all}件`}
        back="/creative"
        actions={
          <Button asChild size="sm">
            <Link href="/creative/notes/new">
              <Plus /> メモ
            </Link>
          </Button>
        }
      />
      {all === 0 ? (
        <EmptyState
          icon="💡"
          title="まだ創作メモがありません。"
          description={
            <>
              本を読んでいて思いついたことを
              <br />
              ここに残しておきましょう。
            </>
          }
          action={
            <Button asChild size="lg">
              <Link href="/creative/notes/new">
                <Plus /> 創作メモ
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <SearchBox initial={sp.q ?? ""} placeholder="タイトル・本文・タグで検索" autoFocus={false} />
          <nav className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" aria-label="カテゴリ">
            <ChipLink href={href(sp, { category: undefined })} active={!category}>
              すべて
            </ChipLink>
            {CREATIVE_CATEGORIES.map((c) => (
              <ChipLink key={c} href={href(sp, { category: category === c ? undefined : c })} active={category === c}>
                {CREATIVE_CATEGORY_EMOJI[c]} {CREATIVE_CATEGORY_LABEL[c]}
              </ChipLink>
            ))}
          </nav>
          <nav className="flex flex-wrap gap-2" aria-label="ステータス">
            {NOTE_STATUSES.map((s) => (
              <ChipLink key={s} href={href(sp, { status: status === s ? undefined : s })} active={status === s} className="h-8 px-3 text-xs">
                {NOTE_STATUS_LABEL[s]}
              </ChipLink>
            ))}
          </nav>
          <p className="text-sm text-muted-foreground">
            {total}件{!status ? "（アーカイブ以外）" : ""}
          </p>
          {items.length === 0 ? (
            <EmptyState icon="🔍" title="該当する創作メモはありません" />
          ) : (
            <div className="space-y-3">
              {items.map((n) => (
                <CreativeNoteCard key={n.id} note={n} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
