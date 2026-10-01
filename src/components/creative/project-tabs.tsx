"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { seg: "", label: "概要" },
  { seg: "characters", label: "👤 人物" },
  { seg: "world", label: "🌍 世界観" },
  { seg: "plots", label: "📋 プロット" },
  { seg: "chapters", label: "📖 章・シーン", also: ["scenes"] },
  { seg: "notes", label: "💡 メモ" },
  { seg: "references", label: "📚 参考資料" },
  { seg: "timeline", label: "🕰 年表" },
  { seg: "ai", label: "🤖 AI編集者" },
];

function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className="size-3.5 animate-spin" aria-label="読み込み中" /> : null;
}

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/creative/projects/${projectId}`;
  const rest = pathname.slice(base.length).split("/")[1] ?? "";
  const active = TABS.find((t) => t.seg === rest || t.also?.includes(rest))?.seg ?? "";
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    nav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [active]);
  return (
    <nav ref={nav} aria-label="作品のメニュー" className="scrollbar-none -mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
      {TABS.map((t) => (
        <Link
          key={t.seg}
          href={t.seg ? `${base}/${t.seg}` : base}
          aria-current={active === t.seg ? "page" : undefined}
          className={cn(
            "flex h-9 shrink-0 items-center gap-1 rounded-full border px-3.5 text-sm whitespace-nowrap transition-colors",
            active === t.seg ? "border-primary bg-primary text-primary-foreground" : t.seg === "ai" ? "border-primary/40 bg-primary/5 text-primary" : "bg-card hover:bg-accent",
          )}
        >
          {t.label}
          <Pending />
        </Link>
      ))}
    </nav>
  );
}
