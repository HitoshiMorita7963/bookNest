import Link from "next/link";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_COLOR, STATUS_LABEL, type BookStatus } from "@/lib/constants";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = status as BookStatus;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", STATUS_COLOR[s], className)}>
      {STATUS_LABEL[s] ?? status}
    </span>
  );
}

export function RatingStars({ value, size = "sm", className }: { value?: number | null; size?: "sm" | "md"; className?: string }) {
  if (!value) return null;
  return (
    <span className={cn("inline-flex items-center gap-px text-highlight", className)} aria-label={`評価 ${value} / 5`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(size === "sm" ? "size-3" : "size-4", i <= value ? "fill-current" : "fill-none opacity-35")} aria-hidden />
      ))}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center", className)}>
      {icon ? <div className="mb-4 text-5xl" aria-hidden>{icon}</div> : null}
      <p className="text-base font-semibold">{title}</p>
      {description ? <div className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</div> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function TagChip({ name, href, className }: { name: string; href?: string; className?: string }) {
  const cls = cn("inline-flex h-7 items-center rounded-full bg-secondary px-2.5 text-xs text-secondary-foreground", href && "hover:bg-accent", className);
  return href ? (
    <Link href={href} className={cls}>
      #{name}
    </Link>
  ) : (
    <span className={cls}>#{name}</span>
  );
}

export function SectionTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-2", className)}>
      <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

export function authorNames(book: { authors: { author: { name: string } }[] }, max = 3) {
  const names = book.authors.map((a) => a.author.name);
  return names.length > max ? names.slice(0, max).join("、") + " 他" : names.join("、");
}
