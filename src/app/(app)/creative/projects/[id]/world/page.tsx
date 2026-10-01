import { prisma } from "@/lib/db";
import { EmptyState, SectionTitle } from "@/components/books/bits";
import { DeleteItemButton, WorldSheetButton } from "@/components/creative/project-forms";
import { WORLD_CATEGORIES } from "@/lib/constants";

export const metadata = { title: "世界観" };

export default async function WorldPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = await prisma.worldSetting.findMany({ where: { projectId: id }, orderBy: { createdAt: "asc" }, include: { _count: { select: { links: true } } } });
  const order = new Map(WORLD_CATEGORIES.map((c, i) => [c, i]));
  const groups = [...new Set(items.map((w) => w.category))].sort((a, b) => (order.get(a as never) ?? 99) - (order.get(b as never) ?? 99));
  return (
    <section>
      <SectionTitle action={<WorldSheetButton projectId={id} />}>🌍 世界観・設定</SectionTitle>
      {items.length === 0 ? (
        <EmptyState icon="🌍" title="まだ世界観の設定がありません" description="舞台となる場所・歴史・文化・技術・魔法などを項目ごとに残せます。" />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g}>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{g}</h3>
              <ul className="space-y-2">
                {items
                  .filter((w) => w.category === g)
                  .map((w) => (
                    <li key={w.id} className="rounded-2xl border bg-card p-4">
                      <div className="flex items-start gap-2">
                        <p className="min-w-0 flex-1 font-semibold">{w.title}</p>
                        <WorldSheetButton projectId={id} world={{ id: w.id, title: w.title, category: w.category, content: w.content }} />
                        <DeleteItemButton kind="world" id={w.id} label={`「${w.title}」`} />
                      </div>
                      {w.content ? <p className="prose-note mt-1 text-sm text-foreground/85">{w.content}</p> : null}
                      {w._count.links ? <p className="mt-1 text-xs text-muted-foreground">📚 参考資料 {w._count.links}</p> : null}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
