"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/form-controls";
import { Dialog, DialogContent, Sheet, SheetContent } from "@/components/ui/overlays";
import type { ActionResult } from "@/lib/errors";

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "textarea" | "select";
  options?: readonly { value: string; label: string }[];
  /** 入力候補（datalist） */
  suggestions?: readonly string[];
  required?: boolean;
  placeholder?: string;
  rows?: number;
  /** 「詳細」として最初は折りたたむ */
  advanced?: boolean;
}

type Values = Record<string, string>;

/** 項目定義から入力フォームを作る（人物・世界観・プロット・章・シーン・作品で共通） */
export function EntityForm({
  fields,
  initial,
  submitLabel,
  onSubmit,
  onDone,
}: {
  fields: FieldDef[];
  initial?: Values;
  submitLabel: string;
  onSubmit: (values: Values) => Promise<ActionResult<unknown>>;
  onDone?: (data: unknown) => void;
}) {
  const [v, setV] = useState<Values>(() => Object.fromEntries(fields.map((f) => [f.name, initial?.[f.name] ?? f.options?.[0]?.value ?? ""])));
  const [showAdvanced, setShowAdvanced] = useState(() => fields.some((f) => f.advanced && initial?.[f.name]));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const visible = fields.filter((f) => !f.advanced || showAdvanced);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    for (const f of fields) if (f.required && !v[f.name]?.trim()) errs[f.name] = `${f.label}を入力してください`;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    start(async () => {
      const res = await onSubmit(v);
      if (!res.ok) return void toast.error(res.error);
      onDone?.(res.data);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {visible.map((f) => {
        const id = `ef-${f.name}`;
        return (
          <Field key={f.name} label={f.required ? `${f.label} *` : f.label} htmlFor={id} error={errors[f.name]}>
            {f.type === "textarea" ? (
              <Textarea id={id} value={v[f.name]} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} rows={f.rows ?? 3} placeholder={f.placeholder} className="min-h-20" />
            ) : f.type === "select" ? (
              <NativeSelect id={id} value={v[f.name]} onChange={(e) => setV({ ...v, [f.name]: e.target.value })}>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <>
                <Input id={id} value={v[f.name]} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} placeholder={f.placeholder} list={f.suggestions ? `${id}-list` : undefined} aria-invalid={!!errors[f.name]} />
                {f.suggestions ? (
                  <datalist id={`${id}-list`}>
                    {f.suggestions.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                ) : null}
              </>
            )}
          </Field>
        );
      })}
      {fields.some((f) => f.advanced) && !showAdvanced ? (
        <Button type="button" variant="ghost" className="w-full" onClick={() => setShowAdvanced(true)}>
          詳細項目も入力する
        </Button>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {submitLabel}
      </Button>
    </form>
  );
}

/** 追加・編集ボタン ＋ Bottom Sheet のフォーム */
export function EntitySheetButton({
  title,
  fields,
  initial,
  onSubmit,
  mode = "create",
  buttonLabel,
  successMessage,
  navigateTo,
}: {
  title: string;
  fields: FieldDef[];
  initial?: Values;
  onSubmit: (values: Values) => Promise<ActionResult<unknown>>;
  mode?: "create" | "edit";
  buttonLabel?: string;
  successMessage: string;
  /** 保存後に移動する先（作成した ID を受け取る） */
  navigateTo?: (data: unknown) => string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      {mode === "create" ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus /> {buttonLabel ?? "追加"}
        </Button>
      ) : (
        <Button variant="ghost" size="icon-sm" aria-label={`${title}`} onClick={() => setOpen(true)}>
          <Pencil />
        </Button>
      )}
      <Sheet open={open} onOpenChange={setOpen} repositionInputs={false}>
        <SheetContent title={title}>
          {open ? (
            <EntityForm
              fields={fields}
              initial={initial}
              submitLabel={mode === "create" ? "追加する" : "保存する"}
              onSubmit={onSubmit}
              onDone={(data) => {
                toast.success(successMessage);
                setOpen(false);
                const to = navigateTo?.(data);
                if (to) router.push(to);
                router.refresh();
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

/** 削除ボタン（確認つき） */
export function DeleteEntityButton({
  label,
  description,
  onDelete,
  redirectTo,
  variant = "icon",
}: {
  label: string;
  description?: string;
  onDelete: () => Promise<ActionResult<unknown>>;
  redirectTo?: string;
  variant?: "icon" | "full";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      {variant === "icon" ? (
        <Button variant="ghost" size="icon-sm" aria-label={`${label}を削除`} onClick={() => setOpen(true)}>
          <Trash2 />
        </Button>
      ) : (
        <Button variant="outline" className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setOpen(true)}>
          <Trash2 /> {label}を削除
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={`${label}を削除しますか？`} description={description ?? "この操作は取り消せません。"}>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await onDelete();
                  if (!res.ok) return void toast.error(res.error);
                  toast.success("削除しました");
                  setOpen(false);
                  if (redirectTo) router.replace(redirectTo);
                  router.refresh();
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <Trash2 />} 削除する
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
