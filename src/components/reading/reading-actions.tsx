"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, CheckCircle2, Loader2, MessageSquareQuote, NotebookPen, RotateCcw, TrendingUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/books/bits";
import { progressPercent } from "@/lib/utils";
import { startReadingAction, startRereadAction } from "@/server/actions/reading";
import { NoteSheet, ProgressSheet, RecordSheet, StatusSheet } from "./reading-sheets";

export interface ReadingBook {
  id: string;
  title: string;
  status: string;
  currentPage: number;
  pageCount: number | null;
}

/** 読書中の本の主要操作（メモ／フレーズ／進捗／読了）。1〜2タップで到達できるようにする */
export function ReadingQuickActions({ book, size = "default" }: { book: ReadingBook; size?: "default" | "compact" }) {
  const [sheet, setSheet] = useState<null | "progress" | "note" | "finish">(null);
  return (
    <>
      <div className={size === "compact" ? "grid grid-cols-4 gap-1.5" : "grid grid-cols-2 gap-2 sm:grid-cols-4"}>
        <ActionButton icon={<TrendingUp />} label="進捗更新" onClick={() => setSheet("progress")} compact={size === "compact"} primary />
        <ActionButton icon={<NotebookPen />} label="メモを書く" onClick={() => setSheet("note")} compact={size === "compact"} />
        <Button asChild variant="outline" className={size === "compact" ? "h-16 flex-col gap-1 px-1 text-xs" : "h-12"}>
          <Link href={`/quotes/new?bookId=${book.id}`}>
            <MessageSquareQuote className="size-5" />
            フレーズ保存
          </Link>
        </Button>
        <ActionButton icon={<CheckCircle2 />} label="読了する" onClick={() => setSheet("finish")} compact={size === "compact"} />
      </div>
      <ProgressSheet open={sheet === "progress"} onOpenChange={(o) => setSheet(o ? "progress" : null)} book={book} />
      <NoteSheet open={sheet === "note"} onOpenChange={(o) => setSheet(o ? "note" : null)} book={book} />
      <RecordSheet open={sheet === "finish"} onOpenChange={(o) => setSheet(o ? "finish" : null)} mode="finish" bookId={book.id} bookTitle={book.title} />
    </>
  );
}

function ActionButton({ icon, label, onClick, compact, primary }: { icon: React.ReactNode; label: string; onClick: () => void; compact?: boolean; primary?: boolean }) {
  return (
    <Button variant={primary ? "default" : "outline"} onClick={onClick} className={compact ? "h-16 flex-col gap-1 px-1 text-xs [&_svg]:size-5" : "h-12 [&_svg]:size-5"}>
      {icon}
      {label}
    </Button>
  );
}

/** 本詳細のステータス・読書操作パネル */
export function BookStatusPanel({ book }: { book: ReadingBook }) {
  const router = useRouter();
  const [statusOpen, setStatusOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [pending, start] = useTransition();
  const pct = progressPercent(book.currentPage, book.pageCount);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? "失敗しました");
      toast.success(msg);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setStatusOpen(true)}
          className="flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm hover:bg-accent"
          aria-label="ステータスを変更"
        >
          <StatusBadge status={book.status} className="px-3 py-1 text-sm" />
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
        {book.status === "READING" && book.pageCount ? (
          <span className="text-sm tabular-nums text-muted-foreground">
            {book.currentPage} / {book.pageCount}ページ
          </span>
        ) : null}
      </div>

      {book.status === "READING" ? (
        <>
          {book.pageCount ? <Progress value={pct} label={`読書進捗 ${pct}%`} /> : null}
          <ReadingQuickActions book={book} />
        </>
      ) : book.status === "COMPLETED" ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-12" onClick={() => run(() => startRereadAction(book.id), "再読を開始しました")} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
            再読する
          </Button>
          <Button asChild variant="outline" className="h-12">
            <Link href={`/quotes/new?bookId=${book.id}`}>
              <MessageSquareQuote /> フレーズ保存
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button className="h-12" onClick={() => run(() => startReadingAction(book.id), "読書を開始しました")} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <BookOpen />}
            {book.status === "PAUSED" ? "読書を再開" : "読み始める"}
          </Button>
          <Button variant="outline" className="h-12" onClick={() => setFinishOpen(true)}>
            <CheckCircle2 /> 読了にする
          </Button>
        </div>
      )}
      <StatusSheet open={statusOpen} onOpenChange={setStatusOpen} bookId={book.id} current={book.status} onFinishRequested={() => setFinishOpen(true)} />
      <RecordSheet open={finishOpen} onOpenChange={setFinishOpen} mode="finish" bookId={book.id} bookTitle={book.title} />
    </div>
  );
}
