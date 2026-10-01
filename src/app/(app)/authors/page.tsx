import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { listAuthors } from "@/server/services/authors";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBox } from "@/components/search/search-box";
import { EmptyState } from "@/components/books/bits";

export const metadata = { title: "著者" };

export default async function AuthorsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const authors = await listAuthors(prisma, q.slice(0, 100) || undefined);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="著者" subtitle={`${authors.length}人`} />
      <div className="mb-4">
        <SearchBox initial={q} placeholder="著者名で検索" autoFocus={false} />
      </div>
      {authors.length === 0 ? (
        <EmptyState icon="👤" title="著者が見つかりません" description="本を登録すると、著者ごとの読書状況を確認できます。" />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {authors.map((a) => (
            <li key={a.id}>
              <Link href={`/authors/${a.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-accent/50">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary" aria-hidden>
                  {a.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.total}冊 ・ 読了 {a.completed}冊{a.avgRating ? ` ・ 平均 ★${a.avgRating.toFixed(1)}` : ""}
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
