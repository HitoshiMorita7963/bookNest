import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { ShelfControls } from "@/components/books/shelf-controls";
import { BookGrid, BookList } from "@/components/books/book-grid";
import { EmptyState } from "@/components/books/bits";
import { Button } from "@/components/ui/button";
import { countByStatus, listBooks, listFacets } from "@/server/services/books";
import { parseBookQuery, withParam } from "@/server/query";
import { PAGE_SIZE, STATUS_LABEL, type BookStatus } from "@/lib/constants";

export const metadata = { title: "本棚" };

export default async function BooksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const query = parseBookQuery(sp);
  const page = query.page ?? 1;
  const [result, counts, facets] = await Promise.all([
    listBooks(prisma, { ...query, page: 1, pageSize: PAGE_SIZE * page }),
    countByStatus(prisma),
    listFacets(prisma),
  ]);
  const totalBooks = Object.values(counts).reduce((a, b) => a + b, 0);
  const title = query.status && STATUS_LABEL[query.status as BookStatus] ? STATUS_LABEL[query.status as BookStatus] : "本棚";

  return (
    <div>
      <PageHeader
        title={title}
        actions={
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/books/new">
              <Plus /> 本を追加
            </Link>
          </Button>
        }
      />
      {totalBooks === 0 ? (
        <EmptyState
          icon="📚"
          title="まだ本がありません。"
          description={
            <>
              最初の1冊を登録して、
              <br />
              あなたの読書ライブラリを作りましょう。
            </>
          }
          action={
            <Button asChild size="lg">
              <Link href="/books/new">
                <Plus /> 本を追加
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          <ShelfControls facets={facets} counts={counts} total={result.total} />
          {result.items.length === 0 ? (
            <EmptyState icon="🔍" title="条件に合う本が見つかりませんでした" description="検索語や絞り込み条件を変えてみてください。" />
          ) : sp.view === "grid" ? (
            <BookGrid books={result.items} />
          ) : (
            <BookList books={result.items} />
          )}
          {result.hasMore ? (
            <div className="flex justify-center pt-2">
              <Button asChild variant="outline" size="lg">
                <Link href={`/books?${withParam(sp, { page: page + 1 })}`} scroll={false}>
                  さらに表示（残り {result.total - result.items.length} 冊）
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
