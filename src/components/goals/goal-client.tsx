"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/form-controls";
import { Sheet, SheetContent } from "@/components/ui/overlays";
import { DEFAULT_GENRES, GOAL_LABEL, GOAL_TYPES, type GoalType } from "@/lib/constants";
import { createGoalAction, deleteGoalAction, updateGoalTargetAction } from "@/server/actions/goals";

export function NewGoalButton({ defaultYear }: { defaultYear: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<GoalType>("YEARLY_BOOKS");
  const [year, setYear] = useState(String(defaultYear));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [genre, setGenre] = useState("");
  const [target, setTarget] = useState("");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await createGoalAction({ type, year: Number(year), month: type === "MONTHLY_BOOKS" ? Number(month) : null, genre: type === "GENRE_BOOKS" ? genre : null, target: target.normalize("NFKC") });
      if (!res.ok) return void toast.error(res.error);
      toast.success("目標を設定しました");
      setOpen(false);
      setTarget("");
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> 目標を追加
      </Button>
      <Sheet open={open} onOpenChange={setOpen} repositionInputs={false}>
        <SheetContent title="読書目標を設定">
          <form onSubmit={submit} className="space-y-4">
            <Field label="目標の種類" htmlFor="g-type">
              <NativeSelect id="g-type" value={type} onChange={(e) => setType(e.target.value as GoalType)}>
                {GOAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {GOAL_LABEL[t]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="年" htmlFor="g-year">
                <Input id="g-year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))} />
              </Field>
              {type === "MONTHLY_BOOKS" ? (
                <Field label="月" htmlFor="g-month">
                  <NativeSelect id="g-month" value={month} onChange={(e) => setMonth(e.target.value)}>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}月
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              ) : null}
            </div>
            {type === "GENRE_BOOKS" ? (
              <Field label="ジャンル" htmlFor="g-genre">
                <Input id="g-genre" list="g-genres" value={genre} onChange={(e) => setGenre(e.target.value)} required />
                <datalist id="g-genres">
                  {DEFAULT_GENRES.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </Field>
            ) : null}
            <Field label={type === "YEARLY_PAGES" ? "目標ページ数" : "目標冊数"} htmlFor="g-target">
              <Input id="g-target" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={type === "YEARLY_PAGES" ? "20000" : "50"} required />
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={pending || !target}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              設定する
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function GoalActions({ id, target }: { id: string; target: number }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [value, setValue] = useState(String(target));
  const [pending, start] = useTransition();
  return (
    <div className="flex">
      <Button variant="ghost" size="icon-sm" aria-label="目標値を変更" onClick={() => setEdit(true)}>
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="目標を削除"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("この目標を削除しますか？")) return;
          start(async () => {
            const res = await deleteGoalAction(id);
            if (!res.ok) return void toast.error(res.error);
            router.refresh();
          });
        }}
      >
        <Trash2 />
      </Button>
      <Sheet open={edit} onOpenChange={setEdit} repositionInputs={false}>
        <SheetContent title="目標値を変更">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await updateGoalTargetAction(id, Number(value.normalize("NFKC")));
                if (!res.ok) return void toast.error(res.error);
                setEdit(false);
                router.refresh();
              });
            }}
          >
            <label htmlFor="goal-target" className="sr-only">
              目標値
            </label>
            <Input id="goal-target" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} className="h-14 text-center text-2xl" />
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              保存する
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
