"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 長い文章を指定行数（既定3行）で折りたたみ、「もっと見る」で全文を表示する。
 * 収まる長さのときはボタンを出さない。
 */
export function ReadMore({ children, lines = 3, className, as = "div" }: { children: ReactNode; lines?: number; className?: string; as?: "div" | "p" | "dd" | "blockquote" }) {
  const ref = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const check = () => setOverflow(el.scrollHeight > el.clientHeight + 2);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, children]);

  const Tag = as;
  return (
    <>
      <Tag
        ref={(node: HTMLElement | null) => {
          ref.current = node;
        }}
        className={cn(className, !open && "overflow-hidden")}
        style={open ? undefined : { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: lines }}
      >
        {children}
      </Tag>
      {overflow || open ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="relative z-10 mt-1 inline-flex min-h-8 items-center gap-0.5 text-sm font-medium text-primary hover:underline"
        >
          {open ? "閉じる" : "もっと見る"}
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      ) : null}
    </>
  );
}
