"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { Sheet, SheetContent } from "@/components/ui/overlays";
import { updateAuthorAction, updateSeriesAction } from "@/server/actions/authors";

export function EditAuthorButton({ author }: { author: { id: string; name: string; nameKana: string | null; profile: string | null } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: author.name, nameKana: author.nameKana ?? "", profile: author.profile ?? "" });
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="ghost" size="icon" aria-label="著者情報を編集" onClick={() => setOpen(true)}>
        <Pencil className="size-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen} repositionInputs={false}>
        <SheetContent title="著者情報を編集">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await updateAuthorAction(author.id, v);
                if (!res.ok) return void toast.error(res.error);
                toast.success("保存しました");
                setOpen(false);
                router.refresh();
              });
            }}
          >
            <Field label="著者名" htmlFor="a-name">
              <Input id="a-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required maxLength={100} />
            </Field>
            <Field label="よみがな" htmlFor="a-kana">
              <Input id="a-kana" value={v.nameKana} onChange={(e) => setV({ ...v, nameKana: e.target.value })} maxLength={100} />
            </Field>
            <Field label="プロフィール" htmlFor="a-profile">
              <Textarea id="a-profile" rows={6} value={v.profile} onChange={(e) => setV({ ...v, profile: e.target.value })} maxLength={5000} />
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              保存する
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function EditSeriesButton({ series }: { series: { id: string; title: string; description: string | null; totalVolumes: number | null } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ title: series.title, description: series.description ?? "", totalVolumes: series.totalVolumes ? String(series.totalVolumes) : "" });
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="ghost" size="icon" aria-label="シリーズ情報を編集" onClick={() => setOpen(true)}>
        <Pencil className="size-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen} repositionInputs={false}>
        <SheetContent title="シリーズを編集">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await updateSeriesAction(series.id, v);
                if (!res.ok) return void toast.error(res.error);
                toast.success("保存しました");
                setOpen(false);
                router.refresh();
              });
            }}
          >
            <Field label="シリーズ名" htmlFor="s-title">
              <Input id="s-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} required maxLength={200} />
            </Field>
            <Field label="全巻数" htmlFor="s-total" hint="入力すると未登録の巻も一覧に表示されます">
              <Input id="s-total" inputMode="numeric" value={v.totalVolumes} onChange={(e) => setV({ ...v, totalVolumes: e.target.value.replace(/\D/g, "") })} />
            </Field>
            <Field label="説明" htmlFor="s-desc">
              <Textarea id="s-desc" rows={4} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} maxLength={2000} />
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              保存する
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
