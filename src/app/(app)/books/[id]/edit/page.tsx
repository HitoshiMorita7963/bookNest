import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { BookForm } from "@/components/books/book-form";
import type { BookStatus } from "@/lib/constants";

export const metadata = { title: "本を編集" };

export default async function EditBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await prisma.book.findUnique({
    where: { id },
    include: {
      authors: { include: { author: true }, orderBy: { position: "asc" } },
      tags: { include: { tag: true } },
      series: true,
    },
  });
  if (!book) notFound();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="本を編集" back />
      <BookForm
        bookId={book.id}
        defaultValues={{
          title: book.title,
          titleKana: book.titleKana ?? "",
          subtitle: book.subtitle ?? "",
          authors: book.authors.map((a) => a.author.name).join("、"),
          publisher: book.publisher ?? "",
          publishedAt: book.publishedAt ?? "",
          pageCount: book.pageCount ? String(book.pageCount) : "",
          isbn: book.isbn13 ?? book.isbn10 ?? "",
          coverImage: book.coverImage ?? "",
          genre: book.genre ?? "",
          tags: book.tags.map((t) => t.tag.name).join("、"),
          seriesTitle: book.series?.title ?? "",
          seriesNumber: book.seriesNumber != null ? String(book.seriesNumber) : "",
          status: book.status as BookStatus,
          acquiredAt: book.acquiredAt ? format(book.acquiredAt, "yyyy-MM-dd") : "",
          description: book.description ?? "",
        }}
      />
    </div>
  );
}
