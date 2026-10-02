"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { Sheet, SheetContent } from "@/components/ui/overlays";
import { linkQuoteKnowledgeAction, pickKnowledgeAction, pickQuotesAction, unlinkQuoteKnowledgeAction } from "@/server/actions/knowledge";
import { truncate } from "@/lib/utils";
import { quoted } from "@/lib/quote-marks";

interface PickItem {
  id: string;
  label: string;
  sub?: string | null;
}

/** 検索して1件選ぶシート（フレーズ⇔知識の関連付け用） */
function PickSheet({
  open,
  onOpenChange,
  title,
  description,
  placeholder,
  search,
  exclude,
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  placeholder: string;
  search: (q: string) => Promise<PickItem[]>;
  exclude: string[];
  onPick: (item: PickItem) => Promise<boolean>;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PickItem[] | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => search(q).then(setItems), 250);
    return () => clearTimeout(t);
  }, [q, open, search]);
  const shown = (items ?? []).filter((i) => !exclude.includes(i.id));
  return (
    <Sheet open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <SheetContent title={title} description={description}>
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="pl-9" aria-label={placeholder} />
          </div>
          {items === null ? (
            <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> 読み込み中…
            </p>
          ) : shown.length ? (
            <ul className="divide-y">
              {shown.map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        if (await onPick(it)) onOpenChange(false);
                      })
                    }
                    className="flex min-h-12 w-full flex-col items-start justify-center gap-0.5 py-2 text-left hover:bg-accent/40"
                  >
                    <span className="font-medium">{it.label}</span>
                    {it.sub ? <span className="text-xs text-muted-foreground">{it.sub}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">{q ? "見つかりませんでした" : "まだありません"}</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

const searchKnowledge = async (q: string): Promise<PickItem[]> => (await pickKnowledgeAction(q)).map((k) => ({ id: k.id, label: `🧠 ${k.title}`, sub: k.category }));
const searchQuotes = async (q: string): Promise<PickItem[]> =>
  (await pickQuotesAction(q)).map((x) => ({ id: x.id, label: quoted(truncate(x.text, 60)), sub: x.book ? `『${x.book.title}』` : null }));

/** フレーズ詳細：既存の知識とつなげる */
export function LinkKnowledgeToQuoteButton({ quoteId, linkedIds }: { quoteId: string; linkedIds: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Link2 /> 知識とつなげる
      </Button>
      <PickSheet
        open={open}
        onOpenChange={setOpen}
        title="知識とつなげる"
        description="このフレーズから得た知識を選んでください"
        placeholder="知識を検索"
        search={searchKnowledge}
        exclude={linkedIds}
        onPick={async (it) => {
          const res = await linkQuoteKnowledgeAction(quoteId, it.id);
          if (!res.ok) {
            toast.error(res.error);
            return false;
          }
          toast.success("知識とつなげました");
          router.refresh();
          return true;
        }}
      />
    </>
  );
}

/** 知識詳細：元になったフレーズを追加 */
export function LinkQuoteToKnowledgeButton({ knowledgeId, linkedIds }: { knowledgeId: string; linkedIds: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Link2 /> フレーズを追加
      </Button>
      <PickSheet
        open={open}
        onOpenChange={setOpen}
        title="元になったフレーズを追加"
        description="この知識のきっかけになったフレーズを選んでください"
        placeholder="フレーズ・本のタイトルで検索"
        search={searchQuotes}
        exclude={linkedIds}
        onPick={async (it) => {
          const res = await linkQuoteKnowledgeAction(it.id, knowledgeId);
          if (!res.ok) {
            toast.error(res.error);
            return false;
          }
          toast.success("フレーズを追加しました");
          router.refresh();
          return true;
        }}
      />
    </>
  );
}

/** フレーズと知識の関連付けを解除 */
export function UnlinkQuoteKnowledgeButton({ quoteId, knowledgeId, className }: { quoteId: string; knowledgeId: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="関連付けを解除"
      title="関連付けを解除"
      disabled={pending}
      className={className}
      onClick={() =>
        start(async () => {
          const res = await unlinkQuoteKnowledgeAction(quoteId, knowledgeId);
          if (!res.ok) return void toast.error(res.error);
          toast.success("関連付けを解除しました", {
            action: {
              label: "元に戻す",
              onClick: async () => {
                await linkQuoteKnowledgeAction(quoteId, knowledgeId);
                router.refresh();
              },
            },
          });
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
    </Button>
  );
}
