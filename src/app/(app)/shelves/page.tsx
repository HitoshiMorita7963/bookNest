import Link from "next/link";
import { prisma } from "@/lib/db";
import { listShelves } from "@/server/services/shelves";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/books/bits";
import { BookCover } from "@/components/books/book-cover";
import { NewShelfButton } from "@/components/shelves/shelf-client";

export const metadata = { title: "マイ本棚" };

export default async function ShelvesPage() {
  const shelves = await listShelves(prisma);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="マイ本棚" actions={<NewShelfButton />} />
      {shelves.length === 0 ? (
        <EmptyState icon="🗂" title="自分だけの本棚を作りましょう" description="「人生ベスト」「再読したい」「2026年ベスト」など、テーマごとに本をまとめられます。1冊の本を複数の本棚に入れられます。" />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {shelves.map((s) => (
            <li key={s.id}>
              <Link href={`/shelves/${s.id}`} className="flex gap-4 rounded-2xl border bg-card p-4 hover:bg-accent/40">
                <div className="flex w-28 shrink-0 -space-x-6">
                  {s.books.length ? (
                    s.books.slice(0, 3).map((sb, i) => (
                      <div key={sb.book.id} className="w-14" style={{ zIndex: 3 - i }}>
                        <BookCover src={sb.book.coverImage} title={sb.book.title} size="xs" />
                      </div>
                    ))
                  ) : (
                    <div className="flex aspect-[2/3] w-14 items-center justify-center rounded-md border border-dashed text-2xl">📚</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-sm text-muted-foreground">{s._count.books}冊</p>
                  {s.description ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description}</p> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
