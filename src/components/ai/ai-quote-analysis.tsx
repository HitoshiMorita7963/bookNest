"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/overlays";
import { KnowledgeForm } from "@/components/knowledge/knowledge-form";
import { analyzeQuoteAction, applyQuoteSuggestionAction } from "@/server/actions/ai";
import type { QuoteAnalysisResult } from "@/server/ai/features";
import { truncate } from "@/lib/utils";

/** AI フレーズ分析：提案は「AI提案」として表示し、ユーザーが選んだものだけ保存する */
export function AiQuoteAnalysis({ quoteId, quoteText, book }: { quoteId: string; quoteText: string; book: { id: string; title: string } | null }) {
  const router = useRouter();
  const [result, setResult] = useState<QuoteAnalysisResult | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [draftOpen, setDraftOpen] = useState(false);
  const [pending, start] = useTransition();

  function analyze() {
    start(async () => {
      const res = await analyzeQuoteAction(quoteId);
      if (!res.ok) return void toast.error(res.error);
      setResult(res.data);
      setTags(res.data.suggestedTags);
      setLinks(res.data.relatedKnowledge.map((k) => k.id));
    });
  }

  function apply() {
    start(async () => {
      const res = await applyQuoteSuggestionAction(quoteId, { addTags: tags, linkKnowledgeIds: links });
      if (!res.ok) return void toast.error(res.error);
      toast.success("AI提案を保存しました");
      setResult(null);
      router.refresh();
    });
  }

  if (!result) {
    return (
      <Button variant="outline" className="w-full" onClick={analyze} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Sparkles className="text-primary" />}
        {pending ? "AIが分析しています…" : "AIでフレーズを分析（テーマ・タグ・関連）"}
      </Button>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-dashed border-primary/50 bg-primary/5 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <Sparkles className="size-4" /> AI提案
        </p>
        <button type="button" aria-label="AI提案を閉じる" onClick={() => setResult(null)} className="flex size-8 items-center justify-center rounded-full hover:bg-accent">
          <X className="size-4" />
        </button>
      </div>
      {result.comment ? <p className="text-sm text-foreground/85">{result.comment}</p> : null}
      {result.themes.length ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">テーマ</p>
          <p className="mt-1 text-sm">{result.themes.join(" ・ ")}</p>
        </div>
      ) : null}
      {result.suggestedTags.length ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">追加するタグ（タップで選択）</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {result.suggestedTags.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tags.includes(t)}
                onClick={() => setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))}
                className={`flex h-8 items-center gap-1 rounded-full border px-3 text-xs ${tags.includes(t) ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}
              >
                {tags.includes(t) ? <Check className="size-3" /> : null}#{t}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {result.relatedKnowledge.length ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">関連付ける知識</p>
          <ul className="mt-1.5 space-y-1">
            {result.relatedKnowledge.map((k) => (
              <li key={k.id}>
                <label className="flex min-h-10 items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={links.includes(k.id)} onChange={(e) => setLinks((p) => (e.target.checked ? [...p, k.id] : p.filter((x) => x !== k.id)))} />
                  🧠 {k.title}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {result.relatedQuotes.length ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">似た内容の過去のフレーズ</p>
          <ul className="mt-1.5 space-y-1.5">
            {result.relatedQuotes.map((q) => (
              <li key={q.id}>
                <Link href={`/quotes/${q.id}`} className="block rounded-lg bg-card p-2 text-sm hover:bg-accent">
                  「{truncate(q.text, 60)}」{q.book ? <span className="text-xs text-muted-foreground"> 『{q.book}』</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button onClick={apply} disabled={pending || (!tags.length && !links.length)}>
          {pending ? <Loader2 className="animate-spin" /> : <Check />} 選んだ提案を保存
        </Button>
        <Button variant="outline" onClick={() => setDraftOpen(true)}>
          <Sparkles /> 知識ノート案を編集
        </Button>
      </div>
      <Sheet open={draftOpen} onOpenChange={setDraftOpen} repositionInputs={false}>
        <SheetContent title="知識ノート（AI提案）" description="内容を確認・編集して保存するか、閉じて破棄してください">
          <KnowledgeForm
            aiProposal
            initial={{
              title: result.knowledgeDraft.title,
              content: result.knowledgeDraft.content,
              category: "",
              tags: result.themes.slice(0, 3).join("、"),
              books: book ? [book] : [],
              quotes: [{ id: quoteId, text: quoteText }],
            }}
          />
        </SheetContent>
      </Sheet>
    </section>
  );
}
