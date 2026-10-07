"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { Sheet, SheetContent } from "@/components/ui/overlays";
import { CK_REFERENCE_ICON, CK_REFERENCE_LABEL } from "@/lib/creative-knowledge";
import { cn } from "@/lib/utils";
import { addCkReferenceAction, pickReadingSourcesAction, removeCkReferenceAction } from "@/server/actions/creative-knowledge";
import type { ReadingSourceOption } from "@/server/services/creative-knowledge-references";

/** 創作知識に「参考にした読書」をつなげる */
export function AddCkReferenceButton({ knowledgeId, title }: { knowledgeId: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"shelf" | "work">("shelf");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ReadingSourceOption[] | null>(null);
  const [picked, setPicked] = useState<ReadingSourceOption | null>(null);
  const [workTitle, setWorkTitle] = useState("");
  const [comment, setComment] = useState("");
  const [location, setLocation] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open || mode !== "shelf") return;
    const t = setTimeout(() => pickReadingSourcesAction(q).then(setItems), 250);
    return () => clearTimeout(t);
  }, [q, open, mode]);

  function reset() {
    setQ("");
    setPicked(null);
    setWorkTitle("");
    setComment("");
    setLocation("");
  }

  function save() {
    if (mode === "shelf" && !picked) return void toast.error("参考にした読書を選んでください");
    if (mode === "work" && !workTitle.trim()) return void toast.error("作品名を入力してください");
    start(async () => {
      const res = await addCkReferenceAction({
        knowledgeId,
        source: mode === "shelf" && picked ? { kind: picked.kind, id: picked.id } : null,
        workTitle: mode === "work" ? workTitle : null,
        comment,
        location,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success("参考にした読書をつなげました");
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <BookOpen /> 読書をつなげる
      </Button>
      <Sheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
        repositionInputs={false}
      >
        <SheetContent title="参考にした読書をつなげる" description={`「${title}」の具体例になった読書を選びます`}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="参考にした読書の種類">
              {(["shelf", "work"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={cn("min-h-9 rounded-lg text-sm", mode === m ? "bg-card font-semibold shadow-sm" : "text-muted-foreground")}
                >
                  {m === "shelf" ? "本棚から選ぶ" : "本棚にない作品"}
                </button>
              ))}
            </div>

            {mode === "shelf" ? (
              picked ? (
                <div className="flex items-start gap-2 rounded-xl border border-primary bg-primary/5 p-3">
                  <span aria-hidden>{CK_REFERENCE_ICON[picked.kind]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">{CK_REFERENCE_LABEL[picked.kind]}</p>
                    <p className="font-medium">{picked.label}</p>
                    {picked.sub ? <p className="text-xs text-muted-foreground">{picked.sub}</p> : null}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
                    選び直す
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="本・フレーズ・読書メモ・感想・知識を検索" className="pl-9" aria-label="読書を検索" />
                  </div>
                  {items === null ? (
                    <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" /> 読み込み中…
                    </p>
                  ) : items.length ? (
                    <ul className="max-h-[35dvh] divide-y overflow-y-auto">
                      {items.map((it) => (
                        <li key={`${it.kind}:${it.id}`}>
                          <button type="button" onClick={() => setPicked(it)} className="flex min-h-12 w-full items-start gap-2 py-2 text-left hover:bg-accent/40">
                            <span aria-hidden>{CK_REFERENCE_ICON[it.kind]}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm">{it.label}</span>
                              <span className="block text-xs text-muted-foreground">
                                {CK_REFERENCE_LABEL[it.kind]}
                                {it.sub ? ` ・ ${it.sub}` : ""}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="py-2 text-sm text-muted-foreground">見つかりませんでした。「本棚にない作品」から作品名で登録できます。</p>
                  )}
                </div>
              )
            ) : (
              <Field label="作品名" htmlFor="ckref-work" hint="映画・漫画・昔読んだ本など、本棚にない作品">
                <Input id="ckref-work" value={workTitle} onChange={(e) => setWorkTitle(e.target.value)} maxLength={200} />
              </Field>
            )}

            <Field label="自分の気づき" htmlFor="ckref-comment" hint="どこが、どう参考になったか">
              <Textarea id="ckref-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={2000} />
            </Field>
            <Field label="場所（任意）" htmlFor="ckref-location">
              <Input id="ckref-location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={100} placeholder="例：第10章、p.142" />
            </Field>
            <Button size="lg" className="w-full" disabled={pending} onClick={save}>
              {pending ? <Loader2 className="animate-spin" /> : <BookOpen />} つなげる
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function RemoveCkReferenceButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`${label}とのつながりを解除`}
      disabled={pending}
      className="relative z-10 shrink-0"
      onClick={() =>
        start(async () => {
          const res = await removeCkReferenceAction(id);
          if (!res.ok) return void toast.error(res.error);
          toast.success("参考にした読書を外しました");
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
    </Button>
  );
}
