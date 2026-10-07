"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Brain, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/form-controls";
import { Sheet, SheetContent } from "@/components/ui/overlays";
import { CK_CATEGORIES, CK_CATEGORY_INFO, CK_REFERENCE_LABEL, ckCategoryLabel, type CkCategory, type CkReferenceKind } from "@/lib/creative-knowledge";
import { cn } from "@/lib/utils";
import { addCkReferenceAction, createCkFromSourceAction, pickCreativeKnowledgeAction } from "@/server/actions/creative-knowledge";

export interface CkSource {
  kind: CkReferenceKind;
  id: string;
}

/**
 * 「創作知識として保存」の中身。
 * 新しく作る：タイトル・カテゴリ・自分の気づきを入れて、元の読書データを「参考にした読書」としてつなぐ。
 * 既存につなげる：既にある創作知識を選んで、元の読書データを参考としてつなぐ。
 */
export function SaveToCkBody({ source, defaultTitle = "", onDone }: { source: CkSource; defaultTitle?: string; onDone: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [title, setTitle] = useState(defaultTitle);
  const [category, setCategory] = useState<CkCategory>("TROPE");
  const [subCategory, setSubCategory] = useState("");
  const [comment, setComment] = useState("");
  const [location, setLocation] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<{ id: string; title: string; category: string }[] | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (mode !== "existing") return;
    const t = setTimeout(() => pickCreativeKnowledgeAction(q).then(setItems), 250);
    return () => clearTimeout(t);
  }, [q, mode]);

  function createNew() {
    if (!title.trim()) return void toast.error("タイトルを入力してください");
    start(async () => {
      const res = await createCkFromSourceAction({ title, category, subCategory: subCategory || null }, { source, comment, location });
      if (!res.ok) return void toast.error(res.error);
      toast.success("🧠 創作知識として保存しました");
      onDone();
      router.push(`/creative/knowledge/${res.data.id}`);
      router.refresh();
    });
  }

  function linkExisting(knowledgeId: string, knowledgeTitle: string) {
    start(async () => {
      const res = await addCkReferenceAction({ knowledgeId, source, comment, location });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`「${knowledgeTitle}」の参考にしました`);
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="保存のしかた">
        {(["new", "existing"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn("min-h-9 rounded-lg text-sm", mode === m ? "bg-card font-semibold shadow-sm" : "text-muted-foreground")}
          >
            {m === "new" ? "新しく作る" : "既存の知識につなげる"}
          </button>
        ))}
      </div>

      {mode === "new" ? (
        <div className="space-y-3">
          <Field label="創作知識のタイトル" htmlFor="sck-title" hint="例：敵から味方へ、伏線回収、雨のモチーフ">
            <Input id="sck-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoComplete="off" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="カテゴリ" htmlFor="sck-category">
              <NativeSelect id="sck-category" value={category} onChange={(e) => setCategory(e.target.value as CkCategory)}>
                {CK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CK_CATEGORY_INFO[c].label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="サブカテゴリ" htmlFor="sck-sub">
              <Input id="sck-sub" list="sck-sub-list" value={subCategory} onChange={(e) => setSubCategory(e.target.value)} maxLength={60} autoComplete="off" />
              <datalist id="sck-sub-list">
                {CK_CATEGORY_INFO[category].subCategories.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="創作知識を検索" className="pl-9" aria-label="創作知識を検索" />
          </div>
          {items === null ? (
            <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> 読み込み中…
            </p>
          ) : items.length ? (
            <ul className="max-h-[30dvh] divide-y overflow-y-auto">
              {items.map((it) => (
                <li key={it.id}>
                  <button type="button" disabled={pending} onClick={() => linkExisting(it.id, it.title)} className="flex min-h-12 w-full items-center gap-2 py-2 text-left hover:bg-accent/40">
                    <span className="flex-1 font-medium">🧠 {it.title}</span>
                    <span className="text-xs text-muted-foreground">{ckCategoryLabel(it.category)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">見つかりませんでした。「新しく作る」から作れます。</p>
          )}
        </div>
      )}

      <Field label="自分の気づき" htmlFor="sck-comment" hint={`この${CK_REFERENCE_LABEL[source.kind]}のどこが参考になったか`}>
        <Textarea id="sck-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={2000} placeholder="例：ライバルが主人公を助ける場面で、それまでの対立の意味が変わった" />
      </Field>
      <Field label="場所（任意）" htmlFor="sck-location">
        <Input id="sck-location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={100} placeholder="例：第10章、p.142" />
      </Field>

      {mode === "new" ? (
        <Button size="lg" className="w-full" disabled={pending} onClick={createNew}>
          {pending ? <Loader2 className="animate-spin" /> : <Brain />} 創作知識として保存
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">上の一覧から知識を選ぶと、気づき・場所と一緒につながります。</p>
      )}
    </div>
  );
}

/** 読書メモ・感想などに置く「創作知識として保存」ボタン */
export function SaveToCkButton({ source, defaultTitle, compact = false }: { source: CkSource; defaultTitle?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {compact ? (
        <Button variant="ghost" size="icon-sm" aria-label="創作知識として保存" title="創作知識として保存" onClick={() => setOpen(true)}>
          <Brain className="size-4" />
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Brain /> 創作知識として保存
        </Button>
      )}
      <Sheet open={open} onOpenChange={setOpen} repositionInputs={false}>
        <SheetContent title="創作知識として保存" description={`この${CK_REFERENCE_LABEL[source.kind]}を、創作に使える知識の具体例として残します`}>
          <SaveToCkBody source={source} defaultTitle={defaultTitle} onDone={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
