"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";
import { continueSceneAction, rewriteSceneTextAction } from "@/server/actions/ai";
import type { ContinueLength, RewriteMode } from "@/server/ai/writer";

export interface AiInfo {
  ready: boolean;
  /** 使えないときの理由（「AI機能がオフのため、」など） */
  reason: string;
  providerLabel: string;
}

/** AI に頼んだときのカーソル位置・選択範囲と、そのときの本文 */
export interface AiRequest {
  start: number;
  end: number;
  value: string;
}

const LENGTHS: { key: ContinueLength; label: string }[] = [
  { key: "short", label: "短め（約200字）" },
  { key: "medium", label: "ふつう（約500字）" },
  { key: "long", label: "長め（約1000字）" },
];
const MODES: { key: RewriteMode; label: string }[] = [
  { key: "describe", label: "描写を足す" },
  { key: "dialogue", label: "会話を増やす" },
  { key: "shorter", label: "短くする" },
  { key: "tension", label: "緊張感を出す" },
  { key: "softer", label: "やわらかく" },
  { key: "free", label: "指示して書き直す" },
];

/**
 * 執筆画面の AI パネル。カーソル位置から続きの案を出す／選んだ文の書き直し案を出す。
 * 案は本文とは別に表示し、「挿入」「置き換える」を押したときだけ本文に入れる。
 */
export function AiAssist({ sceneId, ai, request, onApply, onClose }: { sceneId: string; ai: AiInfo; request: AiRequest; onApply: (text: string) => void; onClose: () => void }) {
  const rewrite = request.end > request.start;
  const selected = request.value.slice(request.start, request.end);
  const [length, setLength] = useState<ContinueLength>("medium");
  const [mode, setMode] = useState<RewriteMode>("describe");
  const [instruction, setInstruction] = useState("");
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function generate() {
    if (rewrite && mode === "free" && !instruction.trim()) return void toast.error("どう書き直すかを入力してください");
    setPending(true);
    const before = request.value.slice(0, request.start);
    const after = request.value.slice(request.end);
    const res = rewrite
      ? await rewriteSceneTextAction(sceneId, { selected, before, after, mode, instruction })
      : await continueSceneAction(sceneId, { before, after, length, instruction });
    setPending(false);
    if (!res.ok) return void toast.error(res.error);
    setDraft(res.data.text);
  }

  return (
    <section className="max-h-[55dvh] shrink-0 overflow-y-auto border-t bg-card px-4 py-3" aria-label={rewrite ? "AIで書き直す" : "AIで続きを書く"}>
      <div className="mx-auto max-w-3xl space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden />
          <h2 className="flex-1 text-sm font-semibold">{rewrite ? `選んだ文を書き直す（${selected.length}字）` : "カーソルの位置から続きを書く"}</h2>
          <Button variant="ghost" size="icon-sm" aria-label="AIパネルを閉じる" onClick={onClose}>
            <X />
          </Button>
        </div>

        {!ai.ready ? (
          <p className="text-sm text-muted-foreground">
            {ai.reason}AIは使えません。
            <Link href="/settings" className="ml-1 text-primary underline-offset-4 hover:underline">
              設定
            </Link>
            で AI 機能をオンにすると使えます。
          </p>
        ) : draft === null ? (
          <>
            {rewrite ? (
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="書き直しの方針">
                {MODES.map((m) => (
                  <Chip key={m.key} on={mode === m.key} onClick={() => setMode(m.key)}>
                    {m.label}
                  </Chip>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="続きの長さ">
                {LENGTHS.map((l) => (
                  <Chip key={l.key} on={length === l.key} onClick={() => setLength(l.key)}>
                    {l.label}
                  </Chip>
                ))}
              </div>
            )}
            <Input
              aria-label="AIへの指示"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              maxLength={500}
              placeholder={rewrite ? (mode === "free" ? "例：もっと切ない雰囲気に／ハルの視点で" : "任意：ほかに伝えたいこと") : "任意：次に起きること・雰囲気など（例：ミオが秘密を打ち明ける）"}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => void generate()} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {pending ? "考えています…" : "案を作る"}
              </Button>
              <p className="flex-1 text-xs text-muted-foreground">本文・人物・あらすじ・前のシーンを {ai.providerLabel} に送ります。</p>
            </div>
          </>
        ) : (
          <>
            <div className="max-h-[32dvh] overflow-y-auto rounded-xl border bg-background p-3 font-serif text-[16px] leading-[1.9] whitespace-pre-wrap" aria-label="AIの案">
              {draft}
            </div>
            <p className="text-xs text-muted-foreground">AIの案です。{rewrite ? "置き換える" : "挿入する"}と本文に入り、あとから自由に直せます。</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => onApply(draft)}>
                {rewrite ? "置き換える" : "挿入する"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void generate()} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />} 別の案
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)} disabled={pending}>
                条件を変える
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick} className={cn("min-h-8 rounded-full border px-3 text-sm", on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent")}>
      {children}
    </button>
  );
}
