import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, StatusBadge } from "@/components/books/bits";
import { BookCover } from "@/components/books/book-cover";
import { RemoveFromShelfButton, ShelfMenu } from "@/components/shelves/shelf-client";

export default async function ShelfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shelf = await prisma.customShelf.findUnique({
    where: { id },
    include: {
      books: {
        orderBy: { addedAt: "desc" },
        include: { book: { include: { authors: { include: { author: true }, orderBy: { position: "asc" } } } } },
      },
    },
  });
  if (!shelf) notFound();
  const bookIds = shelf.books.map((b) => b.bookId);
  return (
    <div>
      <PageHeader title={shelf.name} subtitle={`${shelf.books.length}冊`} back="/shelves" actions={<ShelfMenu shelf={shelf} bookIds={bookIds} />} />
      {shelf.description ? <p className="mb-5 text-sm text-muted-foreground">{shelf.description}</p> : null}
      {shelf.books.length === 0 ? (
        <EmptyState icon="📚" title="まだ本がありません" description="右上の「本を追加」から、この本棚に本を入れましょう。" />
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 min-[400px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {shelf.books.map(({ book: b }) => (
            <li key={b.id} className="relative">
              <RemoveFromShelfButton shelfId={shelf.id} bookId={b.id} title={b.title} />
              <Link href={`/books/${b.id}`} className="block">
                <BookCover src={b.coverImage} title={b.title} author={b.authors[0]?.author.name} />
                <p className="mt-2 line-clamp-2 text-sm font-medium">{b.title}</p>
                <StatusBadge status={b.status} className="mt-1" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
