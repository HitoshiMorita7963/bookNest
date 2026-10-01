"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, Star, Minus, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { Sheet, SheetContent } from "@/components/ui/overlays";
import { cn, progressPercent } from "@/lib/utils";
import { BOOK_STATUSES, STATUS_EMOJI, STATUS_LABEL } from "@/lib/constants";
import { finishReadingAction, updateProgressAction, updateRecordAction } from "@/server/actions/reading";
import { changeStatusAction } from "@/server/actions/books";
import { organizeNotesAction } from "@/server/actions/ai";
import type { OrganizedNotes } from "@/server/ai/features";
import { Progress } from "@/components/ui/primitives";

export function RatingInput({ value, onChange, label = "評価" }: { value: number | null; onChange: (v: number | null) => void; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i}つ星`}
          onClick={() => onChange(value === i ? null : i)}
          className="flex size-11 items-center justify-center rounded-lg text-highlight hover:bg-accent"
        >
          <Star className={cn("size-7", value && i <= value ? "fill-current" : "fill-none opacity-40")} />
        </button>
      ))}
    </div>
  );
}

/* ---------- 進捗更新 ---------- */
type ProgressBook = { id: string; title: string; currentPage: number; pageCount: number | null };

// シートの中身は開くたびにマウントされるため、状態は毎回初期値から始まる
export function ProgressSheet({ open, onOpenChange, book }: { open: boolean; onOpenChange: (o: boolean) => void; book: ProgressBook }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <SheetContent title="進捗を更新" description={`『${book.title}』`}>
        <ProgressBody book={book} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function ProgressBody({ book, onDone }: { book: ProgressBook; onDone: () => void }) {
  const router = useRouter();
  const [page, setPage] = useState(String(book.currentPage));
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const n = Number(page.normalize("NFKC")) || 0;
  const over = !!book.pageCount && n > book.pageCount;

  function bump(d: number) {
    const next = Math.max(0, Math.min(book.pageCount ?? 100000, n + d));
    setPage(String(next));
  }

  function submit() {
    if (over) return;
    start(async () => {
      const res = await updateProgressAction(book.id, { currentPage: page.normalize("NFKC"), minutes: minutes || null, note });
      if (!res.ok) return void toast.error(res.error);
      toast.success(n - book.currentPage > 0 ? `${n - book.currentPage}ページ進みました` : "進捗を記録しました");
      onDone();
      router.refresh();
    });
  }

  return (
        <div className="space-y-5">
          <div className="space-y-3">
            <label htmlFor="cur-page" className="text-sm font-medium">
              現在のページ
            </label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon" onClick={() => bump(-10)} aria-label="10ページ戻す">
                <Minus />
              </Button>
              <div className="relative flex-1">
                <Input
                  id="cur-page"
                  inputMode="numeric"
                  value={page}
                  onChange={(e) => setPage(e.target.value.replace(/[^\d０-９]/g, ""))}
                  className="h-14 text-center text-2xl font-semibold tabular-nums"
                  aria-invalid={over}
                  onFocus={(e) => e.target.select()}
                />
                {book.pageCount ? (
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">/ {book.pageCount}</span>
                ) : null}
              </div>
              <Button type="button" variant="outline" size="icon" onClick={() => bump(10)} aria-label="10ページ進める">
                <Plus />
              </Button>
            </div>
            {book.pageCount ? (
              <>
                <input
                  type="range"
                  min={0}
                  max={book.pageCount}
                  value={Math.min(n, book.pageCount)}
                  onChange={(e) => setPage(e.target.value)}
                  className="w-full accent-[var(--primary)]"
                  aria-label="ページスライダー"
                />
                <Progress value={progressPercent(n, book.pageCount)} />
                <p className="text-right text-sm text-muted-foreground">{progressPercent(n, book.pageCount)}%</p>
              </>
            ) : null}
            {over ? <p className="text-sm text-destructive">総ページ数（{book.pageCount}）を超えています</p> : null}
          </div>
          <Field label="読んだ時間（分・任意）" htmlFor="minutes">
            <Input id="minutes" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} placeholder="30" />
          </Field>
          <Field label="メモ（任意）" htmlFor="p-note">
            <Textarea id="p-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="今日読んだところの感想など" />
          </Field>
          <Button className="w-full" size="lg" onClick={submit} disabled={pending || over}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            記録する
          </Button>
        </div>
  );
}

/* ---------- 読書メモ ---------- */
export function NoteSheet({ open, onOpenChange, book }: { open: boolean; onOpenChange: (o: boolean) => void; book: { id: string; title: string } }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <SheetContent title="読書メモ" description={`『${book.title}』`}>
        <NoteBody bookId={book.id} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function NoteBody({ bookId, onDone }: { bookId: string; onDone: () => void }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  function submit() {
    if (!note.trim()) return;
    start(async () => {
      const res = await updateProgressAction(bookId, { note });
      if (!res.ok) return void toast.error(res.error);
      toast.success("メモを保存しました");
      onDone();
      router.refresh();
    });
  }
  return (
        <div className="space-y-4">
          <label htmlFor="memo" className="sr-only">
            メモ
          </label>
          <Textarea id="memo" value={note} onChange={(e) => setNote(e.target.value)} rows={8} className="min-h-48" placeholder="考えたこと・気づいたこと・疑問など、自由に書きましょう" autoFocus />
          <Button className="w-full" size="lg" onClick={submit} disabled={pending || !note.trim()}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            保存する
          </Button>
        </div>
  );
}

/* ---------- 読了・読書記録の編集 ---------- */
export interface RecordValues {
  startedAt: string;
  finishedAt: string;
  rating: number | null;
  review: string;
  summary: string;
  learned: string;
  memorable: string;
  questions: string;
}

function toDateInput(d?: Date | string | null) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd");
}

interface RecordData {
  id: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  rating: number | null;
  review: string | null;
  summary: string | null;
  learned: string | null;
  memorable: string | null;
  questions: string | null;
  status: string;
}

export function RecordSheet({
  open,
  onOpenChange,
  mode,
  bookId,
  bookTitle,
  record,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "finish" | "edit";
  bookId: string;
  bookTitle: string;
  record?: RecordData;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <SheetContent title={mode === "finish" ? "読了する" : "読書記録を編集"} description={`『${bookTitle}』`}>
        <RecordBody mode={mode} bookId={bookId} bookTitle={bookTitle} record={record} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function RecordBody({
  mode,
  bookId,
  bookTitle,
  record,
  onDone,
}: {
  mode: "finish" | "edit";
  bookId: string;
  bookTitle: string;
  record?: RecordData;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showMore, setShowMore] = useState(mode === "edit" && !!(record?.summary || record?.memorable || record?.questions));
  const [v, setV] = useState<RecordValues>(() => ({
    startedAt: toDateInput(record?.startedAt),
    finishedAt: toDateInput(record?.finishedAt ?? (mode === "finish" ? new Date() : null)),
    rating: record?.rating ?? null,
    review: record?.review ?? "",
    summary: record?.summary ?? "",
    learned: record?.learned ?? "",
    memorable: record?.memorable ?? "",
    questions: record?.questions ?? "",
  }));
  const set = (k: keyof RecordValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((p) => ({ ...p, [k]: e.target.value }));

  function submit(skip = false) {
    start(async () => {
      const payload = skip ? {} : { ...v, startedAt: v.startedAt || null, finishedAt: v.finishedAt || null };
      const res =
        mode === "finish"
          ? await finishReadingAction(bookId, payload)
          : await updateRecordAction(record!.id, { ...payload, status: record!.status as "COMPLETED" });
      if (!res.ok) return void toast.error(res.error);
      toast.success(mode === "finish" ? `🎉 『${bookTitle}』を読了しました` : "読書記録を保存しました");
      onDone();
      router.refresh();
    });
  }

  return (
        <div className="space-y-5">
          <div className="space-y-1">
            <p className="text-sm font-medium">評価</p>
            <RatingInput value={v.rating} onChange={(r) => setV((p) => ({ ...p, rating: r }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="読み始めた日" htmlFor="r-start">
              <Input id="r-start" type="date" value={v.startedAt} onChange={set("startedAt")} />
            </Field>
            <Field label="読み終えた日" htmlFor="r-finish">
              <Input id="r-finish" type="date" value={v.finishedAt} onChange={set("finishedAt")} />
            </Field>
          </div>
          <Field label="感想" htmlFor="r-review">
            <Textarea id="r-review" rows={5} value={v.review} onChange={set("review")} placeholder="読んでどう感じましたか？" />
          </Field>
          <AiOrganize
            bookTitle={bookTitle}
            text={[v.review, v.learned, v.memorable, v.questions, v.summary].filter(Boolean).join("\n\n")}
            onApply={(o) => {
              setV((p) => ({ ...p, summary: o.summary || p.summary, learned: o.learned || p.learned, memorable: o.memorable || p.memorable, questions: o.questions || p.questions }));
              setShowMore(true);
            }}
          />
          <Field label="学んだこと" htmlFor="r-learned">
            <Textarea id="r-learned" rows={4} value={v.learned} onChange={set("learned")} placeholder="この本から得た知識・気づき" />
          </Field>
          {showMore ? (
            <>
              <Field label="要約" htmlFor="r-summary">
                <Textarea id="r-summary" rows={4} value={v.summary} onChange={set("summary")} />
              </Field>
              <Field label="印象に残ったこと" htmlFor="r-memorable">
                <Textarea id="r-memorable" rows={3} value={v.memorable} onChange={set("memorable")} />
              </Field>
              <Field label="疑問点" htmlFor="r-questions">
                <Textarea id="r-questions" rows={3} value={v.questions} onChange={set("questions")} />
              </Field>
            </>
          ) : (
            <Button type="button" variant="ghost" className="w-full" onClick={() => setShowMore(true)}>
              要約・印象に残ったこと・疑問点も書く
            </Button>
          )}
          <div className="grid gap-2">
            <Button size="lg" onClick={() => submit(false)} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {mode === "finish" ? "読了として保存" : "保存する"}
            </Button>
            {mode === "finish" ? (
              <Button variant="ghost" onClick={() => submit(true)} disabled={pending}>
                入力を省略して読了
              </Button>
            ) : null}
          </div>
        </div>
  );
}

/* ---------- ステータス変更 ---------- */
export function StatusSheet({
  open,
  onOpenChange,
  bookId,
  current,
  onFinishRequested,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bookId: string;
  current: string;
  onFinishRequested?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function choose(s: string) {
    if (s === current) return onOpenChange(false);
    if (s === "COMPLETED" && onFinishRequested) {
      onOpenChange(false);
      onFinishRequested();
      return;
    }
    start(async () => {
      const res = await changeStatusAction(bookId, s);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`「${STATUS_LABEL[s as keyof typeof STATUS_LABEL]}」に変更しました`);
      onOpenChange(false);
      router.refresh();
    });
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="ステータスを変更">
        <ul className="grid gap-1.5">
          {BOOK_STATUSES.map((s) => (
            <li key={s}>
              <button
                type="button"
                disabled={pending}
                onClick={() => choose(s)}
                className={cn(
                  "flex h-13 min-h-12 w-full items-center gap-3 rounded-xl border px-4 text-left text-[15px] transition-colors",
                  current === s ? "border-primary bg-primary/10 font-semibold text-primary" : "hover:bg-accent",
                )}
              >
                <span aria-hidden className="text-lg">
                  {STATUS_EMOJI[s]}
                </span>
                {STATUS_LABEL[s]}
                {current === s ? <span className="ml-auto text-xs">現在</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}

/* ---------- AI による読書メモの整理（提案を確認してから反映） ---------- */
function AiOrganize({ bookTitle, text, onApply }: { bookTitle: string; text: string; onApply: (o: OrganizedNotes) => void }) {
  const [proposal, setProposal] = useState<OrganizedNotes | null>(null);
  const [pending, start] = useTransition();
  if (proposal) {
    const rows: [string, string][] = [
      ["要約", proposal.summary],
      ["学んだこと", proposal.learned],
      ["印象に残った点", proposal.memorable],
      ["疑問点", proposal.questions],
    ];
    return (
      <div className="space-y-3 rounded-xl border border-dashed border-primary/50 bg-primary/5 p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <Sparkles className="size-4" /> AI提案（あなたの文章を整理したものです）
        </p>
        <dl className="space-y-2 text-sm">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="prose-note">{v}</dd>
              </div>
            ))}
          {proposal.keywords.length ? (
            <div>
              <dt className="text-xs text-muted-foreground">キーワード</dt>
              <dd>{proposal.keywords.join("、")}</dd>
            </div>
          ) : null}
        </dl>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={() => setProposal(null)}>
            破棄
          </Button>
          <Button
            type="button"
            onClick={() => {
              onApply(proposal);
              setProposal(null);
              toast.success("各項目に反映しました。内容を確認して保存してください");
            }}
          >
            反映する
          </Button>
        </div>
      </div>
    );
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending || text.trim().length < 10}
      onClick={() =>
        start(async () => {
          const res = await organizeNotesAction(bookTitle, text);
          if (!res.ok) return void toast.error(res.error);
          setProposal(res.data);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
      AIで要約・学び・疑問に整理
    </Button>
  );
}
