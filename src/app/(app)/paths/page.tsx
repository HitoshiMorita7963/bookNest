import Link from "next/link";
import { prisma } from "@/lib/db";
import { listPaths } from "@/server/services/paths";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/books/bits";
import { BookCover } from "@/components/books/book-cover";
import { Progress } from "@/components/ui/primitives";
import { NewPathButton } from "@/components/paths/path-client";
import { progressPercent } from "@/lib/utils";

export const metadata = { title: "読書ルート" };

export default async function PathsPage() {
  const paths = await listPaths(prisma);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="読書ルート" actions={<NewPathButton />} />
      {paths.length === 0 ? (
        <EmptyState icon="🛤" title="読書ルートを作りましょう" description="「政治・経済入門」のように、テーマを学ぶための読む順番をコースとして作れます。次に読む本がホームに表示されます。" />
      ) : (
        <ul className="space-y-3">
          {paths.map((p) => (
            <li key={p.id}>
              <Link href={`/paths/${p.id}`} className="block rounded-2xl border bg-card p-4 hover:bg-accent/40">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">🛤 {p.title}</p>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {p.done} / {p.total}冊
                  </span>
                </div>
                {p.description ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p> : null}
                <Progress value={progressPercent(p.done, p.total)} className="mt-3" />
                <div className="mt-3 flex items-center gap-2">
                  <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
                    {p.books.slice(0, 8).map((b) => (
                      <div key={b.bookId} className={`w-9 shrink-0 ${b.book.status === "COMPLETED" ? "opacity-50" : ""}`}>
                        <BookCover src={b.book.coverImage} title={b.book.title} size="xs" />
                      </div>
                    ))}
                  </div>
                </div>
                {p.next ? <p className="mt-2 text-sm text-primary">次に読む：『{p.next.title}』</p> : p.total ? <p className="mt-2 text-sm text-primary">🎉 すべて読了しました</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
