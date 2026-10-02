"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { applyCategoriesAction, suggestCategoriesForUncategorizedAction, suggestCategoryAction } from "@/server/actions/knowledge";
import type { CategoryInput, CategorySuggestion } from "@/server/services/category-suggest";
import { cn } from "@/lib/utils";

function SuggestionChip({ s, active, onClick }: { s: CategorySuggestion; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={s.reason}
      className={cn("inline-flex min-h-9 items-center gap-1 rounded-full border bg-card px-3 text-sm hover:bg-accent", active && "border-primary bg-primary/10 font-medium text-primary")}
    >
      {active ? <Check className="size-3.5" /> : null}
      {s.name}
      {!s.existing ? <span className="rounded bg-secondary px-1 text-[10px] text-muted-foreground">新規</span> : null}
    </button>
  );
}

/** 知識の入力画面：カテゴリの提案ボタンと候補 */
export function CategorySuggestions({ input, current, onPick }: { input: CategoryInput; current: string; onPick: (name: string) => void }) {
  const [items, setItems] = useState<CategorySuggestion[] | null>(null);
  const [by, setBy] = useState<"ai" | "rules">("rules");
  const [pending, start] = useTransition();
  return (
    <div className="-mt-2 space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await suggestCategoryAction(input);
            if (!res.ok) return void toast.error(res.error);
            setItems(res.data.suggestions);
            setBy(res.data.by);
            if (!res.data.suggestions.length) toast.info("提案できるカテゴリが見つかりませんでした");
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} カテゴリを提案
      </Button>
      {items?.length ? (
        <div className="space-y-1.5 rounded-xl bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">{by === "ai" ? "AIの提案" : "提案"}（タップで設定）</p>
          <div className="flex flex-wrap gap-1.5">
            {items.map((s) => (
              <SuggestionChip key={s.name} s={s} active={current.trim() === s.name} onClick={() => onPick(s.name)} />
            ))}
          </div>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {items.map((s) => (
              <li key={s.name}>
                {s.name}：{s.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** 知識一覧の「未分類」：まとめてカテゴリを提案して設定する */
export function SuggestUncategorizedButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ items: { id: string; title: string; suggestions: CategorySuggestion[] }[]; by: "ai" | "rules"; total: number } | null>(null);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();
  const selected = Object.entries(choice).filter(([, c]) => c);

  function load() {
    setData(null);
    startLoad(async () => {
      const res = await suggestCategoriesForUncategorizedAction();
      if (!res.ok) {
        toast.error(res.error);
        return setOpen(false);
      }
      setData(res.data);
      // 最初の候補を選んだ状態にしておく
      setChoice(Object.fromEntries(res.data.items.map((it) => [it.id, it.suggestions[0]?.name ?? ""])));
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs text-primary"
        onClick={(e) => {
          // 見出しの開閉と区別する
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
          load();
        }}
      >
        <Sparkles className="size-3.5" /> カテゴリを提案
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="未分類の知識にカテゴリを付ける" description="提案から選んで、まとめて設定できます。付けないものは「なし」を選んでください。">
          {loading || !data ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> カテゴリを考えています…
            </p>
          ) : !data.items.length ? (
            <p className="py-6 text-sm text-muted-foreground">未分類の知識はありません。</p>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {data.by === "ai" ? "AIの提案" : "同じ本・フレーズ・タグの知識や内容のキーワードからの提案"}
                {data.total > data.items.length ? `（${data.total}件のうち${data.items.length}件。設定後にもう一度押すと続きを提案します）` : ""}
              </p>
              <ul className="max-h-[50dvh] space-y-3 overflow-y-auto pr-1">
                {data.items.map((it) => (
                  <li key={it.id} className="space-y-1.5 rounded-xl border bg-card p-3">
                    <p className="text-sm font-medium">🧠 {it.title}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {it.suggestions.map((s) => (
                        <SuggestionChip key={s.name} s={s} active={choice[it.id] === s.name} onClick={() => setChoice({ ...choice, [it.id]: s.name })} />
                      ))}
                      <button
                        type="button"
                        onClick={() => setChoice({ ...choice, [it.id]: "" })}
                        aria-pressed={!choice[it.id]}
                        className={cn("min-h-9 rounded-full border px-3 text-sm text-muted-foreground hover:bg-accent", !choice[it.id] && "border-primary bg-primary/10 text-primary")}
                      >
                        なし
                      </button>
                    </div>
                    {choice[it.id] ? <p className="text-xs text-muted-foreground">{it.suggestions.find((s) => s.name === choice[it.id])?.reason}</p> : null}
                  </li>
                ))}
              </ul>
              <Button
                size="lg"
                className="w-full"
                disabled={saving || !selected.length}
                onClick={() =>
                  startSave(async () => {
                    const res = await applyCategoriesAction(selected.map(([id, category]) => ({ id, category })));
                    if (!res.ok) return void toast.error(res.error);
                    toast.success(`${res.data.count}件にカテゴリを設定しました`);
                    setOpen(false);
                    router.refresh();
                  })
                }
              >
                {saving ? <Loader2 className="animate-spin" /> : null}
                {selected.length}件にカテゴリを設定
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
