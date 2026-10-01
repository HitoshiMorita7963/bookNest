import { prisma } from "@/lib/db";
import { EmptyState, SectionTitle } from "@/components/books/bits";
import { DeleteItemButton, MoveButtons, PlotSheetButton } from "@/components/creative/project-forms";
import { SceneStatusBadge } from "@/components/creative/bits";

export const metadata = { title: "プロット" };

export default async function PlotsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plots = await prisma.plot.findMany({ where: { projectId: id }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  return (
    <section>
      <SectionTitle action={<PlotSheetButton projectId={id} />}>📋 プロット</SectionTitle>
      {plots.length === 0 ? (
        <EmptyState icon="📋" title="まだプロットがありません" description="起承転結や大きな出来事の流れを、順番に並べていきましょう。" />
      ) : (
        <ol className="space-y-2">
          {plots.map((p, i) => (
            <li key={p.id} className="flex gap-2 rounded-2xl border bg-card p-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{p.title}</p>
                  <SceneStatusBadge status={p.status} />
                </div>
                {p.summary ? <p className="prose-note mt-1 text-sm text-foreground/85">{p.summary}</p> : null}
                {p.notes ? <p className="prose-note mt-1 text-xs text-muted-foreground">メモ：{p.notes}</p> : null}
              </div>
              <div className="flex shrink-0 flex-col items-end">
                <MoveButtons kind="plot" id={p.id} first={i === 0} last={i === plots.length - 1} />
                <div className="flex">
                  <PlotSheetButton projectId={id} plot={{ id: p.id, title: p.title, summary: p.summary ?? "", status: p.status, notes: p.notes ?? "" }} />
                  <DeleteItemButton kind="plot" id={p.id} label={`プロット「${p.title}」`} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
