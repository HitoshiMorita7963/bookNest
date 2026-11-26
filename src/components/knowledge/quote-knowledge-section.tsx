import Link from "next/link";
import { Brain, Plus } from "lucide-react";
import { SectionTitle } from "@/components/books/bits";
import { Button } from "@/components/ui/button";
import { LinkKnowledgeToQuoteButton, UnlinkQuoteKnowledgeButton } from "./quote-knowledge-links";

interface QuoteWithKnowledge {
  id: string;
  book: { id: string } | null;
  knowledge: { knowledge: { id: string; title: string; content: string | null } }[];
}

/**
 * フレーズの「関連する知識」。つなげる・外すはその場で保存される。
 * 編集画面では、編集中の内容が消えないよう、知識の作成画面へ移る「新規」は出さない（editing）。
 */
export function QuoteKnowledgeSection({ quote: q, editing = false }: { quote: QuoteWithKnowledge; editing?: boolean }) {
  return (
    <section aria-label="関連する知識">
      <SectionTitle
        action={
          <div className="flex gap-1.5">
            <LinkKnowledgeToQuoteButton quoteId={q.id} linkedIds={q.knowledge.map((x) => x.knowledge.id)} />
            {editing ? null : (
              <Button asChild size="sm" variant="outline">
                <Link href={`/knowledge/new?quoteId=${q.id}${q.book ? `&bookId=${q.book.id}` : ""}`}>
                  <Plus /> 新規
                </Link>
              </Button>
            )}
          </div>
        }
      >
        <Brain className="size-5 text-primary" /> 関連する知識
      </SectionTitle>
      {q.knowledge.length ? (
        <ul className="space-y-2">
          {q.knowledge.map(({ knowledge: k }) => (
            <li key={k.id} className="flex items-start gap-1 rounded-xl border bg-card hover:bg-accent/40">
              <Link href={`/knowledge/${k.id}`} className="block min-w-0 flex-1 p-3">
                <p className="font-medium">🧠 {k.title}</p>
                {k.content ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{k.content}</p> : null}
              </Link>
              <UnlinkQuoteKnowledgeButton quoteId={q.id} knowledgeId={k.id} className="m-1.5 shrink-0" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {editing
            ? "「知識とつなげる」で既存の知識に関連付けられます。つなげる・外すはすぐ保存されます。"
            : "フレーズ（本の言葉）とメモ（なぜ残したか）から得た理解を「知識」として残せます。「知識とつなげる」で既存の知識に関連付けることもできます。"}
        </p>
      )}
      {editing ? <p className="mt-2 text-xs text-muted-foreground">新しい知識を作るときは、「更新する」で保存してからフレーズの画面の「新規」を使います。</p> : null}
    </section>
  );
}
