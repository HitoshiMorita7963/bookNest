"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type SuggestionGroup = { label: string; items: readonly string[] };

/** 入力中に表示する一致候補の上限 */
const MAX_MATCHES = 12;

/**
 * 分類つきの入力候補。分類を1つ選び、その分類の候補だけを並べる（全部を一度に出すと多すぎるため）。
 * 候補にない文字を入力しているあいだは、全分類から一致するものだけを出す。
 */
export function SuggestionPicker({ label, groups, value, onPick }: { label: string; groups: readonly SuggestionGroup[]; value: string; onPick: (v: string) => void }) {
  const list = useMemo(() => groups.filter((g) => g.items.length), [groups]);
  const [active, setActive] = useState(list[0]?.label ?? "");
  const all = useMemo(() => [...new Set(list.flatMap((g) => g.items))], [list]);

  const query = value.trim();
  const searching = query !== "" && !all.includes(query);
  const matches = searching ? all.filter((s) => s.includes(query)).slice(0, MAX_MATCHES) : [];
  const shown = list.find((g) => g.label === active) ?? list[0];
  if (!shown) return null;

  const chip = (s: string) => {
    const on = value === s;
    return (
      <button
        key={s}
        type="button"
        aria-pressed={on}
        onClick={() => onPick(s)}
        className={cn("min-h-8 rounded-full border px-2.5 text-sm", on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}
      >
        {s}
      </button>
    );
  };

  return (
    <div className="mt-2" role="group" aria-label={`${label}の候補`}>
      {searching ? (
        matches.length ? (
          <div className="flex flex-wrap gap-1.5">{matches.map(chip)}</div>
        ) : (
          <p className="text-xs text-muted-foreground">候補にない{label}です。このまま登録できます。</p>
        )
      ) : (
        <>
          <div className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1 pb-2" role="tablist" aria-label={`${label}の分類`}>
            {list.map((g) => (
              <button
                key={g.label}
                type="button"
                role="tab"
                aria-selected={g.label === shown.label}
                onClick={() => setActive(g.label)}
                className={cn(
                  "shrink-0 rounded-md px-2 py-1 text-xs whitespace-nowrap",
                  g.label === shown.label ? "bg-secondary font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" role="tabpanel" aria-label={shown.label}>
            {shown.items.map(chip)}
          </div>
        </>
      )}
    </div>
  );
}
