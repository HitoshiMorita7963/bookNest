"use client";

import Link, { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function PendingMark() {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className="size-3.5 animate-spin" aria-label="読み込み中" /> : null;
}

/** タグ・期間などの切り替えボタン。押した直後から読み込み中の表示を出す */
export function ChipLink({ href, active, children, className }: { href: string; active?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex h-9 shrink-0 items-center gap-1 rounded-full border px-3.5 text-sm transition-colors active:opacity-70",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
        className,
      )}
    >
      {children}
      <PendingMark />
    </Link>
  );
}
