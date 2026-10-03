import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { getKnowledgeGraph } from "@/server/services/knowledge";
import { PageHeader } from "@/components/layout/page-header";
import { KnowledgeMapClient as KnowledgeMap } from "@/components/knowledge/knowledge-map-client";
import { EmptyState, SectionTitle } from "@/components/books/bits";

export const metadata = { title: "知識マップ" };

export default async function KnowledgeMapPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const graph = await getKnowledgeGraph(prisma);
  const title = new Map(graph.nodes.map((n) => [n.id, n.title]));
  const explicit = graph.edges.filter((e) => !e.implicit);
  return (
    <div>
      <PageHeader title="知識マップ" subtitle={`${graph.nodes.length}件の知識 ・ ${explicit.length}本のつながり`} back="/knowledge" />
      {graph.nodes.length === 0 ? (
        <EmptyState icon="🗺" title="知識ノートがまだありません" description="知識ノートを作り、知識同士をつなげると、ここにマップとして表示されます。" />
      ) : (
        <div className="space-y-8">
          <KnowledgeMap nodes={graph.nodes} edges={graph.edges} initialCategory={category ?? null} />
          {explicit.length ? (
            <details className="group" open={explicit.length <= 20}>
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <SectionTitle>
                  つながり一覧 <span className="text-sm font-normal text-muted-foreground">{explicit.length}本</span>
                </SectionTitle>
              </summary>
              <ul className="divide-y rounded-2xl border bg-card">
                {explicit.map((e) => (
                  <li key={e.fromId + e.toId} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                    <Link href={`/knowledge/${e.fromId}`} className="font-medium hover:underline">
                      {title.get(e.fromId)}
                    </Link>
                    <ArrowRight className="size-4 text-muted-foreground" aria-label="→" />
                    <Link href={`/knowledge/${e.toId}`} className="font-medium hover:underline">
                      {title.get(e.toId)}
                    </Link>
                    {e.label ? <span className="text-xs text-muted-foreground">（{e.label}）</span> : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      )}
    </div>
  );
}
