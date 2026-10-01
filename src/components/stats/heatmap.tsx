"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { addDays, format, startOfWeek, differenceInCalendarWeeks } from "date-fns";
import { ja } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/overlays";
import { sessionsOnDateAction } from "@/server/actions/reading";

export type Activity = Record<string, { pages: number; minutes: number; sessions: number; books: number }>;

function level(pages: number, sessions: number) {
  if (!sessions) return 0;
  if (pages >= 80) return 4;
  if (pages >= 40) return 3;
  if (pages >= 15) return 2;
  return 1;
}

const CELL = 14;
const GAP = 3;

/** GitHub の Contribution Graph 風の読書ヒートマップ。日付をタップでその日の記録を表示 */
export function ReadingHeatmap({ activity, from, to }: { activity: Activity; from: string; to: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof sessionsOnDateAction>> | null>(null);

  const { weeks, months } = useMemo(() => {
    const start = startOfWeek(new Date(from), { weekStartsOn: 0 });
    const end = new Date(to);
    const n = differenceInCalendarWeeks(end, start) + 1;
    const weeks: { date: Date; key: string; inRange: boolean }[][] = [];
    const months: { index: number; label: string }[] = [];
    for (let w = 0; w < n; w++) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(start, w * 7 + d);
        col.push({ date, key: format(date, "yyyy-MM-dd"), inRange: date >= new Date(from) && date <= end });
      }
      weeks.push(col);
      const first = col[0].date;
      if (w === 0 || first.getDate() <= 7) months.push({ index: w, label: format(first, "M月") });
    }
    return { weeks, months };
  }, [from, to]);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, [weeks]);

  async function open(key: string) {
    setSelected(key);
    setDetail(null);
    setDetail(await sessionsOnDateAction(key));
  }

  const width = weeks.length * (CELL + GAP);
  return (
    <div>
      <div ref={scroller} className="overflow-x-auto pb-2" tabIndex={0} aria-label="読書カレンダー（横にスクロールできます）">
        <div style={{ width: width + 24 }} className="relative pl-6">
          <div className="relative mb-1 h-4 text-[10px] text-muted-foreground">
            {months.map((m) => (
              <span key={m.index} className="absolute" style={{ left: m.index * (CELL + GAP) }}>
                {m.label}
              </span>
            ))}
          </div>
          <div className="absolute top-5 left-0 flex flex-col text-[10px] leading-none text-muted-foreground" style={{ gap: GAP }}>
            {["日", "", "火", "", "木", "", "土"].map((d, i) => (
              <span key={i} style={{ height: CELL }} className="flex items-center">
                {d}
              </span>
            ))}
          </div>
          <div className="flex" style={{ gap: GAP }} role="grid">
            {weeks.map((col, wi) => (
              <div key={wi} className="flex flex-col" style={{ gap: GAP }} role="row">
                {col.map((c) => {
                  const a = activity[c.key];
                  const lv = a ? level(a.pages, a.sessions) : 0;
                  return c.inRange ? (
                    <button
                      key={c.key}
                      type="button"
                      role="gridcell"
                      onClick={() => open(c.key)}
                      aria-label={`${format(c.date, "M月d日")}：${a ? `${a.pages}ページ` : "記録なし"}`}
                      className="rounded-[3px] outline-offset-1 hover:ring-1 hover:ring-foreground/40"
                      style={{ width: CELL, height: CELL, background: `var(--heat-${lv})` }}
                    />
                  ) : (
                    <span key={c.key} style={{ width: CELL, height: CELL }} />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
        少ない
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="inline-block size-3 rounded-[3px]" style={{ background: `var(--heat-${l})` }} />
        ))}
        多い
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent title={selected ? format(new Date(selected), "yyyy年M月d日（E）", { locale: ja }) : ""} description="この日の読書記録">
          {!detail ? (
            <Loader2 className="mx-auto my-6 size-6 animate-spin text-muted-foreground" />
          ) : detail.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">この日の読書記録はありません</p>
          ) : (
            <ul className="space-y-2">
              {detail.map((s) => (
                <li key={s.id} className="rounded-xl border bg-card p-3">
                  <Link href={`/books/${s.book.id}`} className="font-medium hover:underline">
                    『{s.book.title}』
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {s.pagesRead ? `${s.pagesRead}ページ` : "メモ"}
                    {s.endPage != null ? `（p.${s.endPage}まで）` : ""}
                    {s.minutes ? ` ・ ${s.minutes}分` : ""}
                  </p>
                  {s.note ? <p className="prose-note mt-1 text-sm">{s.note}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
