"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, Check, Loader2, Plus, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { Sheet, SheetContent } from "@/components/ui/overlays";
import { pickKnowledgeAction } from "@/server/actions/knowledge";
import { createKnowledgeFromNewsAction, refreshNewsAction, saveNewsAction, unlinkNewsKnowledgeAction, unsaveNewsAction } from "@/server/actions/news";
import { cn } from "@/lib/utils";

interface KnowledgeOption {
  id: string;
  title: string;
}

export interface NewsForSave {
  id: string;
  title: string;
  saved: boolean;
  memo: string;
  keyword: string | null;
  linked: KnowledgeOption[];
  candidates: KnowledgeOption[];
}

/** ニュースを保存して、知識につなげる（既存の知識を選ぶ／新しく作る） */
export function NewsSaveButton({ news }: { news: NewsForSave }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={news.saved ? `保存済み：${news.title}` : `保存して知識につなげる：${news.title}`}
        title={news.saved ? "保存済み（知識につなげる）" : "保存して知識につなげる"}
        onClick={() => setOpen(true)}
        className="shrink-0"
      >
        {news.saved ? <BookmarkCheck className="size-5 text-primary" /> : <Bookmark className="size-5" />}
      </Button>
      <Sheet open={open} onOpenChange={setOpen} repositionInputs={false}>
        <SheetContent title={news.saved ? "保存したニュース" : "ニュースを保存"} description={news.title}>
          {open ? <SaveBody news={news} onDone={() => setOpen(false)} /> : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function SaveBody({ news, onDone }: { news: NewsForSave; onDone: () => void }) {
  const router = useRouter();
  const [selected, setSelected] = useState<KnowledgeOption[]>(news.saved ? [] : news.candidates);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<KnowledgeOption[] | null>(null);
  const [memo, setMemo] = useState(news.memo);
  const [newTitle, setNewTitle] = useState(news.keyword ?? "");
  const [pending, start] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => pickKnowledgeAction(q).then((r) => setItems(r.map((k) => ({ id: k.id, title: k.title })))), 250);
    return () => clearTimeout(t);
  }, [q]);

  const linkedIds = news.linked.map((k) => k.id);
  const toggle = (k: KnowledgeOption) => setSelected((cur) => (cur.some((x) => x.id === k.id) ? cur.filter((x) => x.id !== k.id) : [...cur, k]));
  const options = [...news.candidates, ...(items ?? [])].filter((k, i, all) => !linkedIds.includes(k.id) && all.findIndex((x) => x.id === k.id) === i);

  function save() {
    start(async () => {
      const res = await saveNewsAction(news.id, { knowledgeIds: selected.map((k) => k.id), memo });
      if (!res.ok) return void toast.error(res.error);
      toast.success(selected.length ? `保存して、知識${selected.length}件につなげました` : "保存しました");
      onDone();
      router.refresh();
    });
  }

  function createKnowledge() {
    start(async () => {
      const res = await createKnowledgeFromNewsAction(news.id, { title: newTitle });
      if (!res.ok) return void toast.error(res.error);
      toast.success("知識を作って、ニュースとつなげました", { action: { label: "開く", onClick: () => router.push(`/knowledge/${res.data.id}`) } });
      onDone();
      router.refresh();
    });
  }

  function unsave() {
    start(async () => {
      const res = await unsaveNewsAction(news.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success("保存をやめました");
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {news.linked.length ? (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">つながっている知識</p>
          <ul className="flex flex-wrap gap-1.5">
            {news.linked.map((k) => (
              <li key={k.id}>
                <Link href={`/knowledge/${k.id}`} className="inline-flex h-8 items-center rounded-full bg-primary/10 px-3 text-sm text-primary">
                  🧠 {k.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium">知識につなげる{news.candidates.length ? "（見出しから見つけた候補を選んであります）" : ""}</p>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="知識を検索" aria-label="知識を検索" className="pl-9" />
        </div>
        <ul className="max-h-56 divide-y overflow-y-auto rounded-xl border" aria-label="知識の候補">
          {items === null && !options.length ? (
            <li className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> 読み込み中…
            </li>
          ) : options.length ? (
            options.map((k) => {
              const on = selected.some((x) => x.id === k.id);
              return (
                <li key={k.id}>
                  <button type="button" aria-pressed={on} onClick={() => toggle(k)} className={cn("flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm", on ? "bg-primary/10" : "hover:bg-accent/50")}>
                    <span className="min-w-0 flex-1 truncate">🧠 {k.title}</span>
                    {news.candidates.some((c) => c.id === k.id) ? <span className="text-xs text-muted-foreground">候補</span> : null}
                    {on ? <Check className="size-4 text-primary" /> : null}
                  </button>
                </li>
              );
            })
          ) : (
            <li className="p-3 text-sm text-muted-foreground">見つかりません</li>
          )}
        </ul>
      </div>

      <Field label="メモ（任意）" htmlFor={`news-memo-${news.id}`}>
        <Textarea id={`news-memo-${news.id}`} value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} maxLength={2000} placeholder="なぜ気になったか、知識とどう関係するか" />
      </Field>

      <Button size="lg" className="w-full" onClick={save} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <BookmarkCheck />} {selected.length ? `保存して${selected.length}件の知識につなげる` : news.saved ? "メモを保存" : "保存する"}
      </Button>

      <div className="space-y-2 rounded-xl border border-dashed p-3">
        <p className="text-sm font-medium">ニュースから新しい知識を作る</p>
        <div className="flex gap-2">
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="知識のタイトル" aria-label="新しい知識のタイトル" maxLength={200} />
          <Button variant="outline" onClick={createKnowledge} disabled={pending || !newTitle.trim()} className="shrink-0">
            <Plus /> 作る
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">見出しとリンクが知識の内容に入ります。あとで自由に書き足せます。</p>
      </div>

      {news.saved ? (
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={unsave} disabled={pending}>
          保存をやめる
        </Button>
      ) : null}
    </div>
  );
}

/** 知識の画面：ニュースとのつながりを外す */
export function UnlinkNewsButton({ newsId, knowledgeId }: { newsId: string; knowledgeId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="ニュースとのつながりを外す"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await unlinkNewsKnowledgeAction(newsId, knowledgeId);
          if (!res.ok) return void toast.error(res.error);
          toast.success("つながりを外しました");
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
    </Button>
  );
}

/** ホームの「最新のニュース」：すぐに集め直す */
export function RefreshNewsButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="ニュースを更新"
      title="ニュースを更新"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await refreshNewsAction();
          if (!res.ok) return void toast.error(res.error);
          if (res.data.refreshed) toast.success("最新のニュースに更新しました");
          else if (res.data.reason === "too-soon") toast.info("さっき更新したばかりです。数分たってからもう一度どうぞ");
          else toast.error("ニュースを取得できませんでした。しばらくしてからお試しください");
          router.refresh();
        })
      }
    >
      <RefreshCw className={cn("size-4", pending && "animate-spin")} />
    </Button>
  );
}
