"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUp, Bot, Loader2, BookOpen, MessageSquareQuote, Brain, Info } from "lucide-react";
import { Textarea } from "@/components/ui/form-controls";
import { Button } from "@/components/ui/button";
import { SafeMarkdown } from "./safe-markdown";
import { askLibrarianAction } from "@/server/actions/ai";
import { cn, truncate } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: {
    books: { id: string; title: string }[];
    quotes: { id: string; text: string }[];
    knowledge: { id: string; title: string }[];
    mode?: string;
  } | null;
}

const EXAMPLES = [
  "今まで読んだ政治の本を教えて",
  "最近読んだ本と関連する本は？",
  "経済を勉強するなら次に何を読めばいい？",
  "自分がまだ読んでいない分野は？",
  "保存したフレーズから人生に関するものを探して",
  "最近の読書から、興味を持っているテーマを整理して",
  "去年読んだ本で印象に残ったものは？",
];

export function AiChat({ conversationId, initial, status }: { conversationId: string | null; initial: ChatMessage[]; status: { ok: boolean; reason: string } }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [convId, setConvId] = useState(conversationId);
  const [input, setInput] = useState("");
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
      const res = await askLibrarianAction(convId, q);
      if (!res.ok) {
        toast.error(res.error);
        setMessages((m) => m.filter((x) => !x.id.startsWith("tmp-") || x.content !== q));
        setInput(q);
        return;
      }
      setMessages((m) => [...m, { id: res.data.message.id, role: "assistant", content: res.data.message.content, sources: { ...res.data.message.sources, mode: res.data.message.mode } }]);
      if (!convId) {
        setConvId(res.data.conversationId);
        router.replace(`/ai?c=${res.data.conversationId}`, { scroll: false });
      }
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col">
      {!status.ok ? (
        <p className="mb-4 flex gap-2 rounded-xl bg-muted/70 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            {status.reason}アプリ内データの検索結果のみ表示します。
            <Link href="/settings" className="ml-1 text-primary underline">
              設定
            </Link>
            で AI 機能を有効にすると、AI 司書が回答します。
          </span>
        </p>
      ) : null}

      <div className="flex-1 space-y-5" aria-live="polite">
        {messages.length === 0 ? (
          <div className="space-y-5 py-4 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Bot className="size-8" />
            </div>
            <div>
              <p className="text-lg font-semibold">あなたの本棚の司書です</p>
              <p className="mt-1 text-sm text-muted-foreground">本棚・読書履歴・フレーズ・メモ・知識をもとに答えます。</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((e) => (
                <button key={e} type="button" onClick={() => send(e)} className="rounded-full border bg-card px-3.5 py-2 text-left text-sm hover:bg-accent">
                  {e}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} />)
        )}
        {pending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> 本棚を調べています…
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
        <label htmlFor="ai-input" className="sr-only">
          AI司書への質問
        </label>
        <Textarea
          id="ai-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="質問を入力（例：去年読んだ本で印象に残ったものは？）"
          rows={1}
          className="max-h-40 min-h-11 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          maxLength={2000}
        />
        <Button type="submit" size="icon" disabled={pending || !input.trim()} aria-label="送信" className="shrink-0 rounded-xl">
          {pending ? <Loader2 className="animate-spin" /> : <ArrowUp />}
        </Button>
      </form>
    </div>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="prose-note max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] text-primary-foreground">{m.content}</p>
      </div>
    );
  }
  const s = m.sources;
  const has = s && (s.books.length || s.quotes.length || s.knowledge.length);
  return (
    <div className="flex gap-2.5">
      <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden>
        <Bot className="size-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <div className={cn("rounded-2xl rounded-tl-md border bg-card px-4 py-3 text-[15px] leading-relaxed")}>
          <SafeMarkdown text={m.content} />
          {s?.mode === "local" ? <p className="mt-2 text-xs text-muted-foreground">※ 検索モード（AI未使用）</p> : null}
        </div>
        {has ? (
          <div className="rounded-xl bg-muted/50 p-3 text-sm">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{s?.mode === "local" ? "検索で見つかったデータ" : "この回答は以下のデータを参考にしています"}</p>
            <ul className="space-y-1.5">
              {s!.books.slice(0, 8).map((b) => (
                <li key={b.id}>
                  <Link href={`/books/${b.id}`} className="flex items-center gap-1.5 hover:underline">
                    <BookOpen className="size-3.5 shrink-0 text-primary" />『{b.title}』
                  </Link>
                </li>
              ))}
              {s!.quotes.slice(0, 5).map((q) => (
                <li key={q.id}>
                  <Link href={`/quotes/${q.id}`} className="flex items-start gap-1.5 hover:underline">
                    <MessageSquareQuote className="mt-0.5 size-3.5 shrink-0 text-primary" />「{truncate(q.text, 40)}」
                  </Link>
                </li>
              ))}
              {s!.knowledge.slice(0, 5).map((k) => (
                <li key={k.id}>
                  <Link href={`/knowledge/${k.id}`} className="flex items-center gap-1.5 hover:underline">
                    <Brain className="size-3.5 shrink-0 text-primary" />
                    {k.title}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              📖 本 {s!.books.length}冊 ・ 💬 フレーズ {s!.quotes.length}件 ・ 🧠 知識 {s!.knowledge.length}件
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
