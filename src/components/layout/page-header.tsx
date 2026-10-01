"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ページ上部のヘッダー。スマホでは上部に固定し、戻るボタンとアクションを置く。
 */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** true で履歴を戻る / 文字列でそのパスへ */
  back?: boolean | string;
  actions?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <header
      className={cn(
        "sticky top-0 z-30 -mx-4 mb-4 flex min-h-14 items-center gap-1 border-b bg-background/90 px-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-6 md:px-4 lg:static lg:mx-0 lg:mb-6 lg:border-0 lg:bg-transparent lg:px-0 lg:pt-6 lg:backdrop-blur-none",
        className,
      )}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {back ? (
        typeof back === "string" ? (
          <Link href={back} aria-label="戻る" className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-accent">
            <ChevronLeft className="size-6" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
            aria-label="戻る"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-accent"
          >
            <ChevronLeft className="size-6" />
          </button>
        )
      ) : (
        <span className="w-2 lg:hidden" />
      )}
      <div className="min-w-0 flex-1 py-2">
        <h1 className="truncate text-lg font-semibold tracking-tight lg:text-2xl">{title}</h1>
        {subtitle ? <p className="truncate text-xs text-muted-foreground lg:text-sm">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </header>
  );
}
