import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { QuoteCapture } from "@/components/quotes/quote-capture";

export const metadata = { title: "フレーズを保存" };

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ bookId?: string }> }) {
  const { bookId } = await searchParams;
  // 本詳細から来た場合はその本、それ以外は最近更新した読書中の本を自動選択
  const book = bookId
    ? await prisma.book.findUnique({ where: { id: bookId }, select: { id: true, title: true, coverImage: true } })
    : await prisma.book.findFirst({ where: { status: "READING" }, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, coverImage: true } });
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="フレーズを保存" back />
      <QuoteCapture initialBook={book} />
    </div>
  );
}
