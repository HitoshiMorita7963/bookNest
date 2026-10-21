"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, CloudOff, Eye, Loader2, PenLine, Settings2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/form-controls";
import { ManuscriptBody } from "@/components/manuscript/manuscript-body";
import { MANUSCRIPT_CSS } from "@/components/manuscript/manuscript-css";
import { SCENE_STATUSES, SCENE_STATUS_LABEL, type SceneStatus } from "@/lib/constants";
import { countChars } from "@/lib/manuscript";
import { cn } from "@/lib/utils";
import { saveSceneContentAction, setSceneStatusAction } from "@/server/actions/creative";
import { AiAssist, type AiInfo, type AiRequest } from "./ai-assist";

interface Neighbor {
  id: string;
  title: string;
  chapterTitle: string;
}
export interface SceneEditorProps {
  scene: { id: string; title: string; status: string; content: string; updatedAt: string };
  chapter: { id: string; title: string };
  project: { id: string; title: string };
  prev: Neighbor | null;
  next: Neighbor | null;
  ai: AiInfo;
}

type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

/** 入力が止まってから保存するまでの時間 */
const AUTOSAVE_MS = 1200;
const draftKey = (id: string) => `booknest:scene-draft:${id}`;

/** 保存できなかったときのために、書いている本文をこの端末にも退避しておく */
function readDraft(id: string): { content: string; at: number } | null {
  try {
    const raw = localStorage.getItem(draftKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeDraft(id: string, content: string) {
  try {
    localStorage.setItem(draftKey(id), JSON.stringify({ content, at: Date.now() }));
  } catch {
    // 容量不足・プライベートモードなどでは退避しない（サーバーへの保存は続ける）
  }
}
function clearDraft(id: string) {
  try {
    localStorage.removeItem(draftKey(id));
  } catch {}
}

/**
 * 選択範囲を記法で囲む（選択がなければ、記法を入れてカーソルを中に置く）。
 * execCommand を使うと、ブラウザの「元に戻す」が効く。
 */
function wrapSelection(el: HTMLTextAreaElement, before: string, after = "", back = 0) {
  el.focus();
  const { selectionStart: a, selectionEnd: b, value } = el;
  const sel = value.slice(a, b);
  const text = before + sel + after;
  if (!document.execCommand?.("insertText", false, text)) {
    el.setRangeText(text, a, b, "end");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  // back：選択範囲を囲んだあと、末尾から何文字戻した位置にカーソルを置くか（ルビの《》の中など）
  const caret = sel ? a + text.length - back : a + before.length;
  el.setSelectionRange(caret, caret);
}
/** カーソルのある行の頭に全角スペースを入れる（すでにあれば何もしない） */
function indentLine(el: HTMLTextAreaElement) {
  el.focus();
  const { selectionStart: a, value } = el;
  const start = value.lastIndexOf("\n", a - 1) + 1;
  if (value[start] === "　") return;
  el.setSelectionRange(start, start);
  if (!document.execCommand?.("insertText", false, "　")) {
    el.setRangeText("　", start, start, "end");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  el.setSelectionRange(a + 1, a + 1);
}

const TOOLS: { label: string; title: string; run: (el: HTMLTextAreaElement) => void }[] = [
  { label: "ルビ", title: "ルビ：|漢字《かんじ》", run: (el) => (el.selectionStart === el.selectionEnd ? wrapSelection(el, "《", "》") : wrapSelection(el, "|", "《》", 1)) },
  { label: "傍点", title: "傍点：《《強調》》", run: (el) => wrapSelection(el, "《《", "》》") },
  { label: "「」", title: "かぎかっこ", run: (el) => wrapSelection(el, "「", "」") },
  { label: "『』", title: "二重かぎかっこ（作品名・会話の中の会話など）", run: (el) => wrapSelection(el, "『", "』") },
  { label: "字下げ", title: "行の頭に全角スペース", run: indentLine },
  { label: "……", title: "三点リーダー2つ", run: (el) => wrapSelection(el, "……") },
  { label: "――", title: "ダッシュ2つ", run: (el) => wrapSelection(el, "――") },
];

export function SceneEditor({ scene, chapter, project, prev, next, ai }: SceneEditorProps) {
  const router = useRouter();
  const [content, setContent] = useState(scene.content);
  const [status, setStatus] = useState(scene.status);
  const [save, setSave] = useState<SaveState>("saved");
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [vertical, setVertical] = useState(false);
  const [conflict, setConflict] = useState<{ content: string; updatedAt: string } | null>(null);
  // 前回この端末で保存しきれなかった下書きがあれば知らせる（ブラウザだけで描画するので localStorage を直接読める）
  const [aiRequest, setAiRequest] = useState<AiRequest | null>(null);
  const [draft, setDraft] = useState<{ content: string; at: number } | null>(() => {
    const d = readDraft(scene.id);
    return d && d.content !== scene.content ? d : null;
  });

  const area = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef(scene.content);
  const savedRef = useRef(scene.content);
  const baseRef = useRef<string | null>(scene.updatedAt);
  const saving = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const deferred = useDeferredValue(content);
  const chars = useMemo(() => countChars(deferred), [deferred]);
  const startChars = useMemo(() => countChars(scene.content), [scene.content]);

  const doSave = useCallback(
    async (force = false): Promise<boolean> => {
      if (saving.current) await saving.current;
      const text = contentRef.current;
      if (text === savedRef.current && !force) {
        setSave("saved");
        return true;
      }
      const job = (async () => {
        setSave("saving");
        const res = await saveSceneContentAction(scene.id, text, baseRef.current, force);
        if (!res.ok) {
          setSave("error");
          return false;
        }
        if (!res.data.ok) {
          setConflict({ content: res.data.content, updatedAt: res.data.updatedAt });
          setSave("conflict");
          return false;
        }
        baseRef.current = res.data.updatedAt;
        savedRef.current = text;
        setConflict(null);
        if (contentRef.current === text) {
          clearDraft(scene.id);
          setSave("saved");
        } else setSave("dirty");
        return true;
      })();
      saving.current = job;
      try {
        return await job;
      } finally {
        saving.current = null;
      }
    },
    [scene.id],
  );

  /** 入力が止まったら保存する */
  function schedule() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void doSave();
    }, AUTOSAVE_MS);
  }
  /** 待たずにすぐ保存する（画面を離れるときなど） */
  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    return doSave();
  }, [doSave]);

  function onChange(value: string) {
    contentRef.current = value;
    setContent(value);
    writeDraft(scene.id, value);
    if (save !== "conflict") {
      setSave("dirty");
      schedule();
    }
  }

  // タブを閉じる・アプリを切り替えるときは保存し、保存前に閉じようとしたら確認する
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (contentRef.current !== savedRef.current) {
        void flush();
        e.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [flush]);

  /** 保存してから移動する。保存できなければ移動しない */
  /** AI パネルを開く：いまのカーソル位置・選択範囲を覚えておく（選択があれば書き直し、なければ続き） */
  function openAi() {
    const el = area.current;
    if (!el) return;
    setAiRequest({ start: el.selectionStart, end: el.selectionEnd, value: el.value });
  }

  /** AI の案を本文に入れる。execCommand を使うので「元に戻す」で取り消せる */
  function applyAi(text: string) {
    const el = area.current;
    const req = aiRequest;
    if (!el || !req) return;
    let start = req.start;
    let end = req.end;
    // 案を作っているあいだに本文を直していたら、位置を探し直す
    if (el.value !== req.value) {
      if (end > start) {
        const i = el.value.indexOf(req.value.slice(start, end));
        if (i < 0) return void toast.error("書き直す文が見つかりません。もう一度選んでからお試しください");
        [start, end] = [i, i + (end - start)];
      } else start = end = Math.min(start, el.value.length);
    }
    // 続きの案が段落・会話で始まるときは、前の文の途中につながらないよう改行を入れる
    const head = end === start && start > 0 && el.value[start - 1] !== "\n" && /^[　「『（]/.test(text) ? "\n" : "";
    el.focus();
    el.setSelectionRange(start, end);
    if (!document.execCommand?.("insertText", false, head + text)) {
      el.setRangeText(head + text, start, end, "end");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setAiRequest(null);
    toast.success(end > start ? "書き直しました" : "続きを挿入しました");
  }

  async function go(href: string) {
    if (await flush()) router.push(href);
    else toast.error("本文を保存できませんでした。通信状態を確かめて、もう一度お試しください");
  }

  async function changeStatus(v: string) {
    const before = status;
    setStatus(v);
    const res = await setSceneStatusAction(scene.id, v);
    if (!res.ok) {
      setStatus(before);
      return void toast.error(res.error);
    }
    // 状態の変更で更新日時が進むので、自分の変更を衝突と見なさないよう基準を合わせる
    baseRef.current = res.data.updatedAt;
  }

  const top = `/creative/projects/${project.id}`;
  const diff = chars - startChars;

  return (
    <div className="flex h-dvh flex-col bg-background">
      <style>{MANUSCRIPT_CSS}</style>
      <header className="shrink-0 border-b px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <div className="mx-auto flex max-w-3xl items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="目次へ戻る" onClick={() => go(top)}>
            <ChevronLeft />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">
              {project.title} ・ {chapter.title}
            </p>
            <h1 className="truncate font-semibold">{scene.title}</h1>
          </div>
          <SaveIndicator state={save} onRetry={() => void flush()} />
          <NativeSelect aria-label="シーンの状態" value={status} onChange={(e) => void changeStatus(e.target.value)} className="h-9 w-auto shrink-0 py-0 pr-7 pl-2 text-xs">
            {SCENE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {SCENE_STATUS_LABEL[s as SceneStatus]}
              </option>
            ))}
          </NativeSelect>
          <Button variant="ghost" size="icon-sm" aria-label="シーンの設定・参考資料" onClick={() => go(`${top}/scenes/${scene.id}`)}>
            <Settings2 />
          </Button>
        </div>
        <div className="scrollbar-none mx-auto mt-2 flex max-w-3xl items-center gap-1.5 overflow-x-auto px-1">
          <div className="flex shrink-0 rounded-full border bg-card p-0.5 text-sm" role="group" aria-label="表示">
            <button type="button" aria-pressed={mode === "write"} onClick={() => setMode("write")} className={cn("flex items-center gap-1 rounded-full px-3 py-1", mode === "write" && "bg-primary text-primary-foreground")}>
              <PenLine className="size-3.5" /> 書く
            </button>
            <button
              type="button"
              aria-pressed={mode === "preview"}
              onClick={() => setMode("preview")}
              className={cn("flex items-center gap-1 rounded-full px-3 py-1", mode === "preview" && "bg-primary text-primary-foreground")}
            >
              <Eye className="size-3.5" /> プレビュー
            </button>
          </div>
          {mode === "write" ? (
            <button
              type="button"
              title="AIに続きを書いてもらう（文を選んでいれば書き直し）"
              onPointerDown={(e) => e.preventDefault()}
              onClick={openAi}
              aria-expanded={!!aiRequest}
              className={cn("flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-sm", aiRequest ? "border-primary bg-primary text-primary-foreground" : "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10")}
            >
              <Sparkles className="size-3.5" /> AI
            </button>
          ) : null}
          {mode === "write" ? (
            TOOLS.map((t) => (
              <button
                key={t.label}
                type="button"
                title={t.title}
                // ボタンを押してもテキスト欄の選択範囲が消えないようにする
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => area.current && t.run(area.current)}
                className="h-8 shrink-0 rounded-lg border bg-card px-2.5 text-sm hover:bg-accent"
              >
                {t.label}
              </button>
            ))
          ) : (
            <button type="button" aria-pressed={vertical} onClick={() => setVertical((v) => !v)} className={cn("h-8 shrink-0 rounded-lg border px-2.5 text-sm", vertical ? "border-primary bg-primary/10 text-primary" : "bg-card")}>
              縦書き
            </button>
          )}
        </div>
      </header>

      {draft ? (
        <div className="shrink-0 border-b bg-amber-50 px-4 py-2 text-sm dark:bg-amber-950/40" role="status">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
            <span className="flex-1">この端末に、保存されていない下書き（{new Date(draft.at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}）があります。</span>
            <Button
              size="sm"
              onClick={() => {
                onChange(draft.content);
                setDraft(null);
              }}
            >
              復元する
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                clearDraft(scene.id);
                setDraft(null);
              }}
            >
              破棄
            </Button>
          </div>
        </div>
      ) : null}

      {conflict ? (
        <div className="shrink-0 border-b bg-destructive/10 px-4 py-2 text-sm" role="alert">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
            <span className="flex-1">別の画面・端末でこのシーンの本文が更新されています。どちらを残しますか？</span>
            <Button size="sm" onClick={() => void doSave(true)}>
              この画面の内容で上書き
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                contentRef.current = conflict.content;
                savedRef.current = conflict.content;
                baseRef.current = conflict.updatedAt;
                setContent(conflict.content);
                clearDraft(scene.id);
                setConflict(null);
                setSave("saved");
              }}
            >
              あちらの内容を読み込む
            </Button>
          </div>
        </div>
      ) : null}

      <main className="min-h-0 flex-1 overflow-auto">
        {mode === "write" ? (
          <textarea
            ref={area}
            value={content}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => void flush()}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                void flush();
              }
            }}
            aria-label="本文"
            placeholder={"　ここに本文を書きます。\n　ルビは |漢字《かんじ》、傍点は 《《強調》》。入力は自動で保存されます。"}
            spellCheck={false}
            autoCapitalize="off"
            className="mx-auto block h-full min-h-[50dvh] w-full max-w-3xl resize-none bg-transparent px-5 py-6 font-serif text-[17px] leading-[2] outline-none placeholder:text-muted-foreground/60"
          />
        ) : (
          <div className="mx-auto max-w-3xl p-4">
            <article className={cn("ms-paper rounded-lg border px-6 py-8 shadow-sm", vertical && "ms-vertical")} aria-label="プレビュー">
              <h3>{scene.title}</h3>
              {content.trim() ? <ManuscriptBody content={content} /> : <p style={{ color: "#888" }}>まだ本文がありません。</p>}
            </article>
          </div>
        )}
      </main>

      {aiRequest && mode === "write" ? <AiAssist key={`${aiRequest.start}-${aiRequest.end}-${aiRequest.value.length}`} sceneId={scene.id} ai={ai} request={aiRequest} onApply={applyAi} onClose={() => setAiRequest(null)} /> : null}

      <footer className="shrink-0 border-t px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-3xl items-center gap-1 text-sm">
          <Button variant="ghost" size="sm" disabled={!prev} onClick={() => prev && go(`/write/${prev.id}`)} aria-label={prev ? `前のシーン：${prev.title}` : "前のシーンはありません"} className="min-w-0 max-w-[38%]">
            <ChevronLeft /> <span className="truncate">{prev ? prev.title : "前へ"}</span>
          </Button>
          <p className="flex-1 text-center text-xs text-muted-foreground tabular-nums" aria-label="文字数">
            {chars.toLocaleString()}字{diff ? <span className={cn("ml-1", diff > 0 ? "text-primary" : "")}>（{diff > 0 ? "+" : ""}{diff.toLocaleString()}）</span> : null}
          </p>
          <Button variant="ghost" size="sm" disabled={!next} onClick={() => next && go(`/write/${next.id}`)} aria-label={next ? `次のシーン：${next.title}` : "次のシーンはありません"} className="min-w-0 max-w-[38%]">
            <span className="truncate">{next ? next.title : "次へ"}</span> <ChevronRight />
          </Button>
        </div>
      </footer>
      {/* 目次への戻り先（JavaScript が使えないとき用） */}
      <Link href={top} className="sr-only">
        目次へ
      </Link>
    </div>
  );
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "error")
    return (
      <button type="button" onClick={onRetry} className="flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs text-destructive" role="status">
        <CloudOff className="size-3.5" /> 保存できません・再試行
      </button>
    );
  const view = {
    saved: { icon: <Check className="size-3.5" />, text: "保存済み", cls: "text-muted-foreground" },
    dirty: { icon: <PenLine className="size-3.5" />, text: "編集中", cls: "text-muted-foreground" },
    saving: { icon: <Loader2 className="size-3.5 animate-spin" />, text: "保存中", cls: "text-muted-foreground" },
    conflict: { icon: <AlertTriangle className="size-3.5" />, text: "確認が必要", cls: "text-destructive" },
  }[state];
  return (
    <span className={cn("flex shrink-0 items-center gap-1 px-1 text-xs", view.cls)} role="status" aria-label={`本文：${view.text}`}>
      {view.icon}
      <span className="hidden sm:inline">{view.text}</span>
    </span>
  );
}
