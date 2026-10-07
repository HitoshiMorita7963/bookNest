"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/form-controls";
import { CK_CATEGORIES, CK_CATEGORY_INFO, type CkCategory } from "@/lib/creative-knowledge";
import { cn, splitList } from "@/lib/utils";
import { createCreativeKnowledgeAction, updateCreativeKnowledgeAction } from "@/server/actions/creative-knowledge";

export interface CkFormValues {
  title: string;
  category: CkCategory;
  extraCategories: CkCategory[];
  subCategory: string;
  summary: string;
  definition: string;
  effects: string;
  patterns: string;
  flow: string;
  usage: string;
  cautions: string;
  aliases: string;
  tags: string;
}

export const emptyCkForm: CkFormValues = {
  title: "",
  category: "TROPE",
  extraCategories: [],
  subCategory: "",
  summary: "",
  definition: "",
  effects: "",
  patterns: "",
  flow: "",
  usage: "",
  cautions: "",
  aliases: "",
  tags: "",
};

/** 「1行に1項目」で書く欄 */
const LIST_FIELDS: { key: keyof CkFormValues; label: string; placeholder: string; rows: number }[] = [
  { key: "effects", label: "物語上の効果", placeholder: "意外性\n人間関係の変化\nキャラクターの成長", rows: 4 },
  { key: "patterns", label: "主なパターン", placeholder: "共通の敵が現れる\n主人公に救われる\n真実を知る", rows: 4 },
  { key: "flow", label: "感情・展開の流れ", placeholder: "敵対\n疑念\n葛藤\n共闘\n信頼", rows: 4 },
  { key: "usage", label: "使い方", placeholder: "どんな場面で、どう使うと効果的か", rows: 3 },
  { key: "cautions", label: "注意点", placeholder: "簡単に仲間にすると、それまでの敵対関係が軽く見える", rows: 3 },
];

export function CkForm({ id, initial }: { id?: string; initial?: Partial<CkFormValues> }) {
  const router = useRouter();
  const [v, setV] = useState<CkFormValues>({ ...emptyCkForm, ...initial });
  const [pending, start] = useTransition();
  const info = CK_CATEGORY_INFO[v.category];
  const set = <K extends keyof CkFormValues>(k: K, value: CkFormValues[K]) => setV((cur) => ({ ...cur, [k]: value }));

  function save() {
    if (!v.title.trim()) return void toast.error("タイトルを入力してください");
    start(async () => {
      const payload = { ...v, subCategory: v.subCategory || null, tags: splitList(v.tags) };
      const res = id ? await updateCreativeKnowledgeAction(id, payload) : await createCreativeKnowledgeAction(payload);
      if (!res.ok) return void toast.error(res.error);
      toast.success(id ? "創作知識を更新しました" : "🧠 創作知識を保存しました");
      router.push(`/creative/knowledge/${res.data.id}`);
      router.refresh();
    });
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      noValidate
    >
      <section className="space-y-4">
        <Field label="タイトル *" htmlFor="ck-title">
          <Input id="ck-title" value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="例：敵から味方へ" maxLength={120} autoComplete="off" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="カテゴリ *" htmlFor="ck-category">
            <NativeSelect id="ck-category" value={v.category} onChange={(e) => set("category", e.target.value as CkCategory)}>
              {CK_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CK_CATEGORY_INFO[c].no} {CK_CATEGORY_INFO[c].label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="サブカテゴリ" htmlFor="ck-sub" hint="候補から選ぶか自由に入力">
            <Input id="ck-sub" list="ck-sub-list" value={v.subCategory} onChange={(e) => set("subCategory", e.target.value)} maxLength={60} autoComplete="off" />
            <datalist id="ck-sub-list">
              {info.subCategories.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">ほかのカテゴリにも入れる</legend>
          <div className="flex flex-wrap gap-1.5">
            {CK_CATEGORIES.filter((c) => c !== v.category).map((c) => {
              const on = v.extraCategories.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set("extraCategories", on ? v.extraCategories.filter((x) => x !== c) : [...v.extraCategories, c])}
                  className={cn("min-h-9 rounded-full border px-3 text-sm", on ? "border-primary bg-primary/10 font-medium text-primary" : "bg-card hover:bg-accent")}
                >
                  {CK_CATEGORY_INFO[c].label}
                </button>
              );
            })}
          </div>
        </fieldset>
        <Field label="概要" htmlFor="ck-summary" hint="ひとことで言うと？">
          <Textarea id="ck-summary" value={v.summary} onChange={(e) => set("summary", e.target.value)} rows={2} maxLength={1000} placeholder="主人公と敵対していた人物が、物語の途中で主人公側に加わる展開。" />
        </Field>
        <Field label="定義・説明" htmlFor="ck-definition">
          <Textarea id="ck-definition" value={v.definition} onChange={(e) => set("definition", e.target.value)} rows={4} maxLength={5000} />
        </Field>
      </section>

      <section className="space-y-4">
        <p className="text-xs text-muted-foreground">下の欄は「1行に1項目」で書くと、詳細画面で一覧・流れとして表示されます。</p>
        {LIST_FIELDS.map((f) => (
          <Field key={f.key} label={f.label} htmlFor={`ck-${f.key}`}>
            <Textarea id={`ck-${f.key}`} value={v[f.key] as string} onChange={(e) => set(f.key, e.target.value)} rows={f.rows} maxLength={5000} placeholder={f.placeholder} />
          </Field>
        ))}
      </section>

      <section className="space-y-4">
        <Field label="タグ" htmlFor="ck-tags" hint="「、」区切り（例：成長、裏切り、ファンタジー）">
          <Input id="ck-tags" value={v.tags} onChange={(e) => set("tags", e.target.value)} autoComplete="off" />
        </Field>
        <Field label="別名・言い換え" htmlFor="ck-aliases" hint="1行に1つ。検索で見つけやすくなります（例：敵が仲間になる）">
          <Textarea id="ck-aliases" value={v.aliases} onChange={(e) => set("aliases", e.target.value)} rows={2} maxLength={2000} />
        </Field>
      </section>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0">
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          {id ? "保存する" : "創作知識を保存"}
        </Button>
      </div>
    </form>
  );
}
