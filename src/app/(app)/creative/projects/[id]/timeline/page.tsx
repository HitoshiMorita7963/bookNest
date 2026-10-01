import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { groupByDay, projectTimeline } from "@/server/services/novels";
import { SectionTitle } from "@/components/books/bits";
import { cn } from "@/lib/utils";

export const metadata = { title: "創作タイムライン" };

export default async function TimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groups = groupByDay(await projectTimeline(prisma, id));
  return (
    <section>
      <SectionTitle>🕰 創作タイムライン</SectionTitle>
      <p className="mb-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-amber-500" /> 読書
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-primary" /> 創作
        </span>
      </p>
      <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-0.5 before:bg-border">
        {groups.map((g) => (
          <li key={g.day} className="relative pl-6">
            <p className="mb-1.5 text-sm font-semibold tabular-nums">{g.day}</p>
            <ul className="space-y-1.5">
              {g.events.map((e, i) => (
                <li key={i} className="relative flex items-start gap-2 text-sm">
                  <span className={cn("absolute top-1.5 -left-[22px] size-2.5 rounded-full ring-2 ring-background", e.kind === "reading" ? "bg-amber-500" : "bg-primary")} aria-hidden />
                  <span className="w-11 shrink-0 text-xs text-muted-foreground tabular-nums">{format(e.date, "HH:mm")}</span>
                  <span aria-hidden>{e.icon}</span>
                  {e.href ? (
                    <Link href={e.href} className="min-w-0 flex-1 hover:underline">
                      {e.label}
                    </Link>
                  ) : (
                    <span className="min-w-0 flex-1">{e.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
