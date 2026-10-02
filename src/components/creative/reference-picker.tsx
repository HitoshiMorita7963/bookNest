"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Link2, Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { Sheet, SheetContent } from "@/components/ui/overlays";
import { TargetPicker, type TargetValue } from "./target-picker";
import { pickBooksAction } from "@/server/actions/books";
import { pickKnowledgeAction, pickQuotesAction } from "@/server/actions/knowledge";
import { createLinkAction, pickCreativeNotesAction } from "@/server/actions/creative";
import { LINK_SOURCE_KINDS, LINK_SOURCE_LABEL, REFERENCE_PURPOSES, type LinkSourceKind, type LinkTargetKind } from "@/lib/constants";
import { cn, truncate } from "@/lib/utils";
import { quoted } from "@/lib/quote-marks";

interface Option {
  id: string;
  label: string;
  sub?: string;
}

async function search(kind: LinkSourceKind, q: string): Promise<Option[]> {
  if (kind === "book") return (await pickBooksAction(q)).map((b) => ({ id: b.id, label: `『${b.title}』`, sub: b.authors.map((a) => a.author.name).join("、") }));
  if (kind === "quote") return (await pickQuotesAction(q)).map((x) => ({ id: x.id, label: quoted(truncate(x.text, 50)), sub: x.book ? `『${x.book.title}』` : undefined }));
  if (kind === "knowledge") return (await pickKnowledgeAction(q)).map((k) => ({ id: k.id, label: `🧠 ${k.title}`, sub: k.category ?? undefined }));
  return (await pickCreativeNotesAction(q)).map((n) => ({ id: n.id, label: `💡 ${n.title}` }));
}

/**
 * 参考資料を追加：本・フレーズ・知識・創作メモ → 作品（または人物・シーンなど）
 * fixedTarget を渡すと、その要素（例：人物の画面ならその人物）に固定する
 */
export function AddReferenceButton({
  projectId,
  fixedTarget,
  label = "資料を追加",
}: {
  projectId: string;
  fixedTarget?: { kind: Exclude<LinkTargetKind, "note">; id: string; label: string };
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus /> {label}
      </Button>
      <Sheet open={open} onOpenChange={setOpen} repositionInputs={false}>
        <SheetContent title="参考資料を追加" description={fixedTarget ? `「${fixedTarget.label}」の参考資料` : "この作品の参考資料"}>
          {open ? <ReferenceBody projectId={projectId} fixedTarget={fixedTarget} onDone={() => setOpen(false)} /> : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function ReferenceBody({ projectId, fixedTarget, onDone }: { projectId: string; fixedTarget?: { kind: Exclude<LinkTargetKind, "note">; id: string; label: string }; onDone: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<LinkSourceKind>("book");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Option[] | null>(null);
  const [selected, setSelected] = useState<Option | null>(null);
  const [target, setTarget] = useState<TargetValue | null>(null);
  const [purpose, setPurpose] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => search(kind, q).then((r) => !cancelled && setItems(r)), 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [kind, q]);

  function save() {
    if (!selected) return void toast.error("資料を選んでください");
    const tgt = fixedTarget ? { kind: fixedTarget.kind, id: fixedTarget.id } : target?.target;
    if (!tgt) return void toast.error("紐付け先を選んでください");
    start(async () => {
      const res = await createLinkAction({ source: { kind, id: selected.id }, target: tgt, purpose: (fixedTarget ? purpose : target?.purpose) || null });
      if (!res.ok) return void toast.error(res.error);
      toast.success("参考資料を追加しました");
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="資料の種類">
        {LINK_SOURCE_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => {
              setKind(k);
              setSelected(null);
              setItems(null);
            }}
            className={cn("h-9 rounded-lg text-sm font-medium", kind === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
          >
            {LINK_SOURCE_LABEL[k]}
          </button>
        ))}
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`${LINK_SOURCE_LABEL[kind]}を検索`} className="pl-9" aria-label={`${LINK_SOURCE_LABEL[kind]}を検索`} />
      </div>
      <div className="max-h-56 overflow-y-auto rounded-xl border">
        {!items ? (
          <Loader2 className="mx-auto my-4 size-5 animate-spin text-muted-foreground" />
        ) : items.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">見つかりません</p>
        ) : (
          <ul className="divide-y">
            {items.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => setSelected(it)}
                  aria-pressed={selected?.id === it.id}
                  className={cn("flex min-h-12 w-full items-center gap-2 px-3 py-2 text-left text-sm", selected?.id === it.id ? "bg-primary/10" : "hover:bg-accent/50")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2">{it.label}</span>
                    {it.sub ? <span className="block truncate text-xs text-muted-foreground">{it.sub}</span> : null}
                  </span>
                  {selected?.id === it.id ? <Check className="size-4 text-primary" /> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {fixedTarget ? (
        <Field label="用途（任意）" htmlFor="ref-purpose">
          <Input id="ref-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="人物造形・会話・情景描写 など" maxLength={60} />
          <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pt-1">
            {REFERENCE_PURPOSES.map((p) => (
              <button key={p} type="button" onClick={() => setPurpose(p)} className={cn("h-8 shrink-0 rounded-full border px-3 text-xs", purpose === p ? "border-primary bg-primary/10 text-primary" : "bg-card text-muted-foreground")}>
                {p}
              </button>
            ))}
          </div>
        </Field>
      ) : (
        <TargetPicker fixedProjectId={projectId} onChange={setTarget} />
      )}
      <Button size="lg" className="w-full" onClick={save} disabled={pending || !selected}>
        {pending ? <Loader2 className="animate-spin" /> : <Link2 />} 参考資料に追加
      </Button>
    </div>
  );
}
