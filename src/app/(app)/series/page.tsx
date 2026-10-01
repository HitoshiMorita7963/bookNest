import Link from "next/link";
import { prisma } from "@/lib/db";
import { listSeries } from "@/server/services/authors";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/books/bits";
import { BookCover } from "@/components/books/book-cover";
import { Progress } from "@/components/ui/primitives";
import { progressPercent } from "@/lib/utils";

export const metadata = { title: "シリーズ" };

export default async function SeriesListPage() {
  const series = await listSeries(prisma);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="シリーズ" />
      {series.length === 0 ? (
        <EmptyState icon="📚" title="シリーズはまだありません" description="本の編集画面で「シリーズ」と「巻」を入力すると、ここで巻ごとの読書状況を確認できます。" />
      ) : (
        <ul className="space-y-3">
          {series.map((s) => {
            const done = s.books.filter((b) => b.status === "COMPLETED").length;
            const total = Math.max(s.totalVolumes ?? 0, s.books.length);
            return (
              <li key={s.id}>
                <Link href={`/series/${s.id}`} className="block rounded-2xl border bg-card p-4 hover:bg-accent/40">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{s.title}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {done} / {total}巻 読了
                    </p>
                  </div>
                  <Progress value={progressPercent(done, total)} className="mt-2" />
                  <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto">
                    {s.books.slice(0, 10).map((b) => (
                      <div key={b.id} className="w-12 shrink-0">
                        <BookCover src={b.coverImage} title={b.title} size="xs" />
                      </div>
                    ))}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
