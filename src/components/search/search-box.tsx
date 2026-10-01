"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/form-controls";
import { signalNavigation } from "@/components/layout/navigation-progress";

export function SearchBox({ initial = "", placeholder = "本・フレーズ・知識・メモを検索", autoFocus = true }: { initial?: string; placeholder?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(initial);
  const [pending, start] = useTransition();
  const go = (url: string) => {
    signalNavigation();
    start(() => router.push(url));
  };
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        go(v ? `${pathname}?q=${encodeURIComponent(v)}` : pathname);
      }}
      className="relative"
    >
      {pending ? (
        <Loader2 className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 animate-spin text-primary" aria-label="検索中" />
      ) : (
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      )}
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label="検索キーワード"
        className="h-12 rounded-xl pr-11 pl-11"
        inputMode="search"
        enterKeyHint="search"
        autoFocus={autoFocus && !initial}
        maxLength={100}
      />
      {q ? (
        <button
          type="button"
          aria-label="検索語を消去"
          onClick={() => {
            setQ("");
            go(pathname);
          }}
          className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </form>
  );
}
