import Link from "next/link";
import { cn } from "@/lib/utils";

export function PeriodTabs<T extends string>({ value, options, base, param = "period" }: { value: T; options: Record<T, string>; base: string; param?: string }) {
  return (
    <nav className="grid h-11 grid-flow-col gap-1 rounded-xl bg-muted p-1" aria-label="期間">
      {(Object.keys(options) as T[]).map((k) => (
        <Link
          key={k}
          href={`${base}?${param}=${k}`}
          scroll={false}
          aria-current={value === k ? "page" : undefined}
          className={cn(
            "flex items-center justify-center rounded-lg px-2 text-sm font-medium whitespace-nowrap",
            value === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {options[k]}
        </Link>
      ))}
    </nav>
  );
}

export function StatTile({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">
        {value}
        {unit ? <span className="ml-0.5 text-sm font-normal text-muted-foreground">{unit}</span> : null}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
