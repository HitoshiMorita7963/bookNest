"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUp, Bot, Check, History, Info, Loader2, Pencil, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, NativeSelect, Textarea } from "@/components/ui/form-controls";
import { Sheet, SheetContent } from "@/components/ui/overlays";
import { SafeMarkdown } from "./safe-markdown";
import { applyProposalAction, askEditorAction } from "@/server/actions/ai";
import type { EditorSources, Proposal } from "@/server/ai/editor";
import { CREATIVE_CATEGORY_LABEL, type CreativeCategory } from "@/lib/constants";
import { truncate } from "@/lib/utils";
import { quoted } from "@/lib/quote-marks";

export interface EditorMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: (EditorSources & { proposals?: Proposal[]; mode?: string }) | null;
}

const EXAMPLES = ["主人公について相談する", "この章を整理する", "関連する読書資料を探して", "似た創作メモを探して", "この設定の問題点を整理して"];
const FIELD_LABEL: Record<string, string> = {
  logline: "一行あらすじ",
  synopsis: "作品概要",
  theme: "テーマ",
  genre: "ジャンル",
  role: "役割",
  age: "年齢",
  appearance: "外見",
  personality: "性格",
  background: "過去",
  goal: "目的",
  conflict: "葛藤",
  speechStyle: "話し方",
  notes: "メモ",
  content: "内容",
  summary: "概要",
};
const TARGET_LABEL: Record<string, string> = { project: "作品", character: "人物", world: "世界観", plot: "プロット", chapter: "章", scene: "シーン" };
const CREATIVE_ICON: Record<string, string> = { note: "💡", project: "✍️", character: "👤", world: "🌍", plot: "📋", chapter: "📖", scene: "🎬" };

export function EditorChat({
  projectId,
  projectTitle,
  conversationId,
  initial,
  chapters,
  characters,
  status,
  conversations,
}: {
  projectId: string;
  projectTitle: string;
  conversationId: string | null;
  initial: EditorMessage[];
  chapters: { id: string; title: string }[];
  characters: { id: string; name: string; role: string | null }[];
  status: { ok: boolean; reason: string };
  conversations: { id: string; title: string; updatedAt: string }[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initial);
  const [convId, setConvId] = useState(conversationId);
  const [input, setInput] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [characterId, setCharacterId] = useState("");
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeReading, setIncludeReading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pending, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  function send(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    setInput("");
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: "user", content: q }]);
    start(async () => {
      const res = await askEditorAction(projectId, convId, q, { chapterId: chapterId || null, characterId: characterId || null, includeNotes, includeReading });
      if (!res.ok) {
        toast.error(res.error);
        setInput(q);
        return;
      }
      const m = res.data.message;
      setMessages((prev) => [...prev, { id: m.id, role: "assistant", content: m.content, sources: { ...m.sources, proposals: m.proposals, mode: m.mode } }]);
      if (!convId) {
        setConvId(res.data.conversationId);
        router.replace(`/creative/projects/${projectId}/ai?c=${res.data.conversationId}`, { scroll: false });
      }
    });
  }

  const contextSummary = [projectTitle, chapters.find((c) => c.id === chapterId)?.title, characters.find((c) => c.id === characterId)?.name, includeNotes ? "関連創作メモ" : null, includeReading ? "関連読書資料" : null].filter(Boolean).join(" ・ ");

  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">🤖 AI編集者</p>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}>
            <History /> 履歴
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/creative/projects/${projectId}/ai`}>
              <Plus /> 新しい相談
            </Link>
          </Button>
        </div>
      </div>

      {!status.ok ? (
        <p className="mb-3 flex gap-2 rounded-xl bg-muted/70 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            {status.reason}作品の参考資料とアプリ内の検索結果を表示します。
            <Link href="/settings" className="ml-1 text-primary underline">
              設定
            </Link>
            で AI 機能を有効にすると、AI 編集者が相談に乗ります。
          </span>
        </p>
      ) : null}

      <details className="mb-4 rounded-xl border bg-card">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm">
          <span className="text-muted-foreground">対象：</span>
          <span className="min-w-0 flex-1 truncate font-medium">{contextSummary}</span>
        </summary>
        <div className="space-y-3 border-t p-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked disabled aria-label="作品" /> ✍️ {projectTitle}
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">📖 章</span>
              <NativeSelect value={chapterId} onChange={(e) => setChapterId(e.target.value)} aria-label="対象の章">
                <option value="">指定しない</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">👤 人物</span>
              <NativeSelect value={characterId} onChange={(e) => setCharacterId(e.target.value)} aria-label="対象の人物">
                <option value="">指定しない</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.role ? `（${c.role}）` : ""}
                  </option>
                ))}
              </NativeSelect>
            </label>
          </div>
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <Checkbox checked={includeNotes} onCheckedChange={(c) => setIncludeNotes(c === true)} /> 💡 関連創作メモ・作品データを検索する
          </label>
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <Checkbox checked={includeReading} onCheckedChange={(c) => setIncludeReading(c === true)} /> 📚 関連読書資料（本・フレーズ・知識）を検索する
          </label>
          <p className="text-xs text-muted-foreground">AIに送られるのは、作品の基本情報・選んだ章や人物と、質問に関係して検索されたデータだけです。</p>
        </div>
      </details>

      <div className="flex-1 space-y-5" aria-live="polite">
        {messages.length === 0 ? (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Bot className="size-7" />
            </div>
            <div>
              <p className="text-lg font-semibold">何について相談しますか？</p>
              <p className="mt-1 text-sm text-muted-foreground">例えば：主人公の人物像を整理する／第3章について相談する／関連する読書資料を探す／似た創作メモを探す</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((e) => (
                <button key={e} type="button" onClick={() => send(e)} className="rounded-full border bg-card px-3.5 py-2 text-sm hover:bg-accent">
                  {e}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <EditorBubble key={m.id} m={m} projectId={projectId} />)
        )}
        {pending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> 作品と読書データを調べています…
          </div>
        ) : null}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] mt-4 flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm lg:bottom-4"
      >
        <label htmlFor="editor-input" className="sr-only">
          AI編集者への相談
        </label>
        <Textarea
          id="editor-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="例：主人公の動機を整理して"
          rows={1}
          className="max-h-40 min-h-11 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          maxLength={3000}
        />
        <Button type="submit" size="icon" disabled={pending || !input.trim()} aria-label="送信" className="shrink-0 rounded-xl">
          {pending ? <Loader2 className="animate-spin" /> : <ArrowUp />}
        </Button>
      </form>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent title="この作品の相談履歴">
          {conversations.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">まだ相談はありません</p>
          ) : (
            <ul className="space-y-1">
              {conversations.map((c) => (
                <li key={c.id}>
                  <Link href={`/creative/projects/${projectId}/ai?c=${c.id}`} onClick={() => setHistoryOpen(false)} className="block rounded-lg px-3 py-2.5 hover:bg-accent">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(c.updatedAt).toLocaleString("ja-JP")}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function EditorBubble({ m, projectId }: { m: EditorMessage; projectId: string }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="prose-note max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] text-primary-foreground">{m.content}</p>
      </div>
    );
  }
  const s = m.sources;
  const has = s && (s.books.length || s.quotes.length || s.knowledge.length || s.creative?.length);
  return (
    <div className="flex gap-2.5">
      <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden>
        <Bot className="size-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="rounded-2xl rounded-tl-md border bg-card px-4 py-3 text-[15px] leading-relaxed">
          <SafeMarkdown text={m.content} />
          {s?.mode === "local" ? <p className="mt-2 text-xs text-muted-foreground">※ 検索モード（AI未使用）</p> : null}
        </div>
        {has ? (
          <div className="rounded-xl bg-muted/50 p-3 text-sm">
            <p className="mb-2 text-xs font-medium text-muted-foreground">参照したBookNestデータ</p>
            <ul className="space-y-1.5">
              {s!.books.slice(0, 8).map((b) => (
                <li key={b.id}>
                  <Link href={`/books/${b.id}`} className="hover:underline">
                    📚 『{b.title}』
                  </Link>
                </li>
              ))}
              {s!.quotes.slice(0, 6).map((q) => (
                <li key={q.id}>
                  <Link href={`/quotes/${q.id}`} className="hover:underline">
                    💬 {quoted(truncate(q.text, 40))}
                  </Link>
                </li>
              ))}
              {s!.knowledge.slice(0, 6).map((k) => (
                <li key={k.id}>
                  <Link href={`/knowledge/${k.id}`} className="hover:underline">
                    🧠 {k.title}
                  </Link>
                </li>
              ))}
              {(s!.creative ?? []).slice(0, 10).map((c) => (
                <li key={`${c.kind}:${c.id}`}>
                  <Link href={c.href} className="hover:underline">
                    {CREATIVE_ICON[c.kind]} {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {s?.proposals?.length ? (
          <div className="space-y-2">
            {s.proposals.map((p, i) => (
              <ProposalCard key={i} proposal={p} projectId={projectId} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** AI の変更提案：採用 / 編集して採用 / 却下 */
function ProposalCard({ proposal, projectId }: { proposal: Proposal; projectId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"open" | "editing" | "applied" | "rejected">("open");
  const [value, setValue] = useState(proposal.type === "update" ? proposal.value : proposal.content);
  const [pending, start] = useTransition();
  const title =
    proposal.type === "update"
      ? `${TARGET_LABEL[proposal.target]}「${proposal.label ?? ""}」の${FIELD_LABEL[proposal.field] ?? proposal.field}を変更`
      : `創作メモを作成「${proposal.title}」（${CREATIVE_CATEGORY_LABEL[proposal.category as CreativeCategory] ?? "その他"}）`;

  function apply(edited: boolean) {
    start(async () => {
      const p: Proposal = proposal.type === "update" ? { ...proposal, value: edited ? value : proposal.value } : { ...proposal, content: edited ? value : proposal.content };
      const res = await applyProposalAction(projectId, p);
      if (!res.ok) return void toast.error(res.error);
      setState("applied");
      toast.success("提案を採用しました");
      router.refresh();
    });
  }

  if (state === "rejected") return <p className="text-xs text-muted-foreground">提案を却下しました：{title}</p>;
  return (
    <div className="space-y-2 rounded-xl border border-dashed border-primary/50 bg-primary/5 p-3">
      <p className="flex items-start gap-1.5 text-sm font-semibold text-primary">
        <Sparkles className="mt-0.5 size-4 shrink-0" /> AI提案：{title}
      </p>
      {proposal.reason ? <p className="text-xs text-muted-foreground">理由：{proposal.reason}</p> : null}
      {state === "editing" ? (
        <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={5} aria-label="提案内容を編集" />
      ) : (
        <p className="prose-note rounded-lg bg-card p-2 text-sm">{proposal.type === "update" ? proposal.value : proposal.content}</p>
      )}
      {state === "applied" ? (
        <p className="flex items-center gap-1 text-sm text-primary">
          <Check className="size-4" /> 採用しました
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {state === "editing" ? (
            <Button size="sm" onClick={() => apply(true)} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Check />} 編集して採用
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={() => apply(false)} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Check />} 採用
              </Button>
              <Button size="sm" variant="outline" onClick={() => setState("editing")}>
                <Pencil /> 編集して採用
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => setState("rejected")}>
            <X /> 却下
          </Button>
        </div>
      )}
    </div>
  );
}
