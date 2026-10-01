"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { History, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/overlays";
import { deleteConversationAction } from "@/server/actions/ai";
import { cn } from "@/lib/utils";

export interface ConvItem {
  id: string;
  title: string;
  updatedAt: string;
}

function List({ items, current, onNavigate }: { items: ConvItem[]; current: string | null; onNavigate?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!items.length) return <p className="px-2 py-4 text-sm text-muted-foreground">まだ会話はありません</p>;
  return (
    <ul className="space-y-0.5">
      {items.map((c) => (
        <li key={c.id} className={cn("group flex items-center rounded-lg", current === c.id ? "bg-primary/10" : "hover:bg-accent")}>
          <Link href={`/ai?c=${c.id}`} onClick={onNavigate} className="min-w-0 flex-1 px-3 py-2.5">
            <p className={cn("truncate text-sm", current === c.id && "font-semibold text-primary")}>{c.title}</p>
            <p className="text-[11px] text-muted-foreground">{new Date(c.updatedAt).toLocaleDateString("ja-JP")}</p>
          </Link>
          <button
            type="button"
            aria-label={`「${c.title}」を削除`}
            disabled={pending}
            onClick={() => {
              if (!window.confirm("この会話を削除しますか？")) return;
              start(async () => {
                const res = await deleteConversationAction(c.id);
                if (!res.ok) return void toast.error(res.error);
                if (current === c.id) router.replace("/ai");
                router.refresh();
              });
            }}
            className="mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-background"
          >
            <Trash2 className="size-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ConversationHistoryButton({ items, current }: { items: ConvItem[]; current: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon" aria-label="会話履歴" onClick={() => setOpen(true)} className="lg:hidden">
        <History className="size-5" />
      </Button>
      <Button asChild variant="ghost" size="icon" aria-label="新しい会話">
        <Link href="/ai">
          <Plus className="size-5" />
        </Link>
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent title="会話履歴">
          <List items={items} current={current} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

export function ConversationSidebar({ items, current }: { items: ConvItem[]; current: string | null }) {
  return (
    <aside className="hidden w-64 shrink-0 lg:block">
      <div className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-2xl border bg-card p-2">
        <p className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">会話履歴</p>
        <List items={items} current={current} />
      </div>
    </aside>
  );
}
