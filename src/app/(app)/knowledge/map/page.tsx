import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { getKnowledgeGraph } from "@/server/services/knowledge";
import { PageHeader } from "@/components/layout/page-header";
import { KnowledgeMapClient as KnowledgeMap } from "@/components/knowledge/knowledge-map-client";
import { EmptyState, SectionTitle } from "@/components/books/bits";

export const metadata = { title: "知識マップ" };

export default async function KnowledgeMapPage() {
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
          <KnowledgeMap nodes={graph.nodes} edges={graph.edges} />
          <p className="text-sm text-muted-foreground">ドラッグで移動、ボタンやホイールで拡大・縮小できます。知識をタップすると、つながりが強調されます。</p>
          {explicit.length ? (
            <section>
              <SectionTitle>つながり一覧</SectionTitle>
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
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
