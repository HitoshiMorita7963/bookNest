"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { renameKnowledgeCategoryAction } from "@/server/actions/knowledge";

/**
 * カテゴリ名をまとめて変更する（知識一覧のカテゴリ見出しから）。
 * 既にあるカテゴリ名にすると統合される。category が null のときは「未分類」の知識にカテゴリを付ける。
 */
export function RenameCategoryButton({ category, count, categories }: { category: string | null; count: number; categories: { name: string; count: number }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category ?? "");
  const [pending, start] = useTransition();
  const next = name.normalize("NFKC").trim();
  const target = categories.find((c) => c.name === next && c.name !== category);
  const unchanged = next === (category ?? "");
  const label = category ?? "未分類";

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`カテゴリ「${label}」の名前を変更`}
        title="名前を変更・統合"
        onClick={(e) => {
          // 見出しの開閉と区別する
          e.preventDefault();
          e.stopPropagation();
          setName(category ?? "");
          setOpen(true);
        }}
      >
        <Pencil className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={category ? `カテゴリ「${category}」の名前を変更` : "未分類の知識にカテゴリを付ける"}
          description={`${count}件の知識のカテゴリをまとめて変更します。既にあるカテゴリ名にすると、そのカテゴリに統合されます。`}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (unchanged) return setOpen(false);
              start(async () => {
                const res = await renameKnowledgeCategoryAction(category, next);
                if (!res.ok) return void toast.error(res.error);
                toast.success(res.data.merged ? `「${next}」に統合しました（${res.data.count}件）` : next ? `「${next}」に変更しました（${res.data.count}件）` : `${res.data.count}件を未分類にしました`);
                setOpen(false);
                router.refresh();
              });
            }}
          >
            <Field label="新しいカテゴリ名" htmlFor="cat-rename" hint={category ? "空にすると未分類に戻します" : undefined}>
              <Input id="cat-rename" list="cat-rename-list" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" autoFocus />
              <datalist id="cat-rename-list">
                {categories
                  .filter((c) => c.name !== category)
                  .map((c) => (
                    <option key={c.name} value={c.name} />
                  ))}
              </datalist>
            </Field>
            {target ? (
              <p className="rounded-lg bg-accent p-3 text-sm">
                既にある「{target.name}」（{target.count}件）に統合されます。統合後は {target.count + count}件になります。
              </p>
            ) : null}
            {categories.length > 1 ? (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">既にあるカテゴリに統合する</p>
                <div className="flex flex-wrap gap-1.5">
                  {categories
                    .filter((c) => c.name !== category)
                    .map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setName(c.name)}
                        className="min-h-9 rounded-full border bg-card px-3 text-sm hover:bg-accent aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary"
                        aria-pressed={next === c.name}
                      >
                        {c.name} <span className="text-xs opacity-70">{c.count}</span>
                      </button>
                    ))}
                </div>
              </div>
            ) : null}
            <Button type="submit" size="lg" className="w-full" disabled={pending || (!category && !next)}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {target ? "統合する" : "変更する"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
