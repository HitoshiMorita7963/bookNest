import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SIDEBAR_GROUPS } from "@/components/layout/nav-config";

export const metadata = { title: "メニュー" };

export default function MorePage() {
  const groups = SIDEBAR_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.href !== "/") }));
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="メニュー" />
      <div className="space-y-6">
        {groups.map((g, i) => (
          <section key={i}>
            {g.title ? <h2 className="mb-2 px-1 text-xs font-medium tracking-wider text-muted-foreground">{g.title}</h2> : null}
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
              {g.items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="flex min-h-13 items-center gap-3 px-4 py-3 hover:bg-accent/50 active:bg-accent">
                    <item.icon className="size-5 text-primary" aria-hidden />
                    <span className="flex-1 text-[15px]">{item.label}</span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
