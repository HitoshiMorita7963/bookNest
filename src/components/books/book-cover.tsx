"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const PALETTE = [
  ["#2f5d50", "#e9e2cf"],
  ["#7a4b2a", "#f3e6d3"],
  ["#3b4a6b", "#e4e7ef"],
  ["#6b3b4a", "#f1e2e6"],
  ["#4d5b2f", "#eef0dc"],
  ["#5a4a6e", "#ebe5f1"],
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** 書影。画像が無い・読み込めない場合はタイトル入りの装丁風プレースホルダーを表示 */
export function BookCover({
  src,
  title,
  author,
  className,
  size = "md",
  priority,
}: {
  src?: string | null;
  title: string;
  author?: string | null;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [bg, fg] = PALETTE[hash(title) % PALETTE.length];
  const showImg = src && !failed;
  return (
    <div
      className={cn(
        "relative aspect-[2/3] w-full overflow-hidden rounded-md bg-muted shadow-[0_1px_2px_rgba(0,0,0,0.08),0_4px_12px_-4px_rgba(0,0,0,0.15)] ring-1 ring-black/5",
        className,
      )}
    >
      {showImg ? (
        <img
          src={src}
          alt={`『${title}』の表紙`}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full flex-col justify-between p-[8%]" style={{ background: bg, color: fg }} role="img" aria-label={`『${title}』`}>
          <div className="h-px w-full opacity-40" style={{ background: fg }} />
          <p
            className={cn(
              "line-clamp-5 font-serif leading-snug font-semibold break-words",
              size === "xs" ? "text-[7px]" : size === "sm" ? "text-[10px]" : size === "lg" ? "text-lg" : "text-[13px]",
            )}
          >
            {title}
          </p>
          {author && size !== "xs" ? (
            <p className={cn("line-clamp-1 opacity-80", size === "lg" ? "text-sm" : "text-[9px]")}>{author}</p>
          ) : (
            <span />
          )}
        </div>
      )}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[4%] bg-gradient-to-r from-black/15 to-transparent" />
    </div>
  );
}
