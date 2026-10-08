import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, SectionTitle } from "@/components/books/bits";
import { NewsList } from "@/components/news/news-list";
import { listSavedNews, listTodayNews } from "@/server/services/news";

export const metadata = { title: "ニュース" };
export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const [today, saved] = await Promise.all([listTodayNews(prisma), listSavedNews(prisma)]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="📰 ニュース" subtitle={`保存 ${saved.length}件`} back="/" />
      <div className="space-y-8">
        <section aria-label="保存したニュース">
          <SectionTitle>🔖 保存したニュース</SectionTitle>
          {saved.length ? (
            <NewsList items={saved} showDay />
          ) : (
            <EmptyState icon="🔖" title="まだ保存したニュースはありません" description="ホームの「本日のニュース」で 🔖 を押すと、ここに残り、知識につなげられます。" />
          )}
        </section>
        {today.length ? (
          <section aria-label="本日のニュース">
            <SectionTitle>📰 本日のニュース</SectionTitle>
            <NewsList items={today} />
            <p className="mt-2 text-xs text-muted-foreground">保存しなかったニュースは3日たつと消えます。</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
