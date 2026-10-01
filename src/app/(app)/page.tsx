import Link from "next/link";
import { prisma } from "@/lib/db";
import { BookGrid } from "@/components/books/book-grid";
import { bookListInclude } from "@/server/services/books";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const recent = await prisma.book.findMany({ include: bookListInclude, orderBy: { createdAt: "desc" }, take: 12 });
  return (
    <div className="space-y-6 pt-6">
      <h1 className="text-2xl font-bold">こんにちは</h1>
      <Button asChild><Link href="/books/new">本を追加</Link></Button>
      <BookGrid books={recent} />
    </div>
  );
}
