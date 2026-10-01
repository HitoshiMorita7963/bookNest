import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Bot, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { getProject, projectReferences, projectTimeline } from "@/server/services/novels";
import { SectionTitle } from "@/components/books/bits";
import { Button } from "@/components/ui/button";
import { DeleteProjectButton } from "@/components/creative/project-forms";

export const metadata = { title: "小説プロジェクト" };

export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, refs, timeline] = await Promise.all([getProject(prisma, id), projectReferences(prisma, id), projectTimeline(prisma, id)]);
  if (!p) notFound();
  const base = `/creative/projects/${p.id}`;
  const influence = [
    { icon: "📚", label: "本", n: refs.counts.book, href: `${base}/references?type=book` },
    { icon: "💬", label: "フレーズ", n: refs.counts.quote, href: `${base}/references?type=quote` },
    { icon: "🧠", label: "知識", n: refs.counts.knowledge, href: `${base}/references?type=knowledge` },
    { icon: "💡", label: "創作メモ", n: refs.counts.note, href: `${base}/notes` },
  ];
  const structure = [
    { icon: "👤", label: "人物", n: p._count.characters, href: `${base}/characters` },
    { icon: "🌍", label: "世界観", n: p._count.worldSettings, href: `${base}/world` },
    { icon: "📋", label: "プロット", n: p._count.plots, href: `${base}/plots` },
    { icon: "📖", label: "章", n: p._count.chapters, href: `${base}/chapters` },
  ];
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        {p.logline ? <p className="text-lg leading-relaxed font-semibold">{p.logline}</p> : null}
        <div className="flex flex-wrap gap-2 text-sm">
          {p.genre ? <span className="rounded-full bg-secondary px-3 py-1">ジャンル：{p.genre}</span> : null}
          {p.theme ? <span className="rounded-full bg-secondary px-3 py-1">テーマ：{p.theme}</span> : null}
        </div>
        {p.synopsis ? (
          <div className="prose-note rounded-2xl border bg-card p-4 text-[15px] leading-relaxed">{p.synopsis}</div>
        ) : (
          <Link href={`${base}/edit`} className="flex items-center justify-between rounded-2xl border border-dashed p-4 text-sm text-muted-foreground hover:bg-accent/40">
            {p.logline ? "作品概要・テーマ・ジャンルを書き足しましょう" : "一行あらすじ・作品概要・テーマを書いてみましょう"}
            <ChevronRight className="size-4" />
          </Link>
        )}
      </section>

      <section>
        <SectionTitle>この作品に影響を与えたもの</SectionTitle>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {influence.map((x) => (
            <li key={x.label}>
              <Link href={x.href} className="block rounded-xl border bg-card p-3 hover:bg-accent/40">
                <p className="text-xs text-muted-foreground">
                  {x.icon} {x.label}
                </p>
                <p className="text-2xl font-bold tabular-nums">
                  {x.n}
                  <span className="ml-0.5 text-xs font-normal text-muted-foreground">{x.label === "本" ? "冊" : "件"}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>作品の構成</SectionTitle>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {structure.map((x) => (
            <li key={x.label}>
              <Link href={x.href} className="flex items-center justify-between rounded-xl border bg-card p-3 hover:bg-accent/40">
                <span className="text-sm">
                  {x.icon} {x.label}
                </span>
                <span className="font-semibold tabular-nums">{x.n}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Link href={`${base}/ai`} className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 hover:bg-primary/10">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Bot className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">AI編集者に相談する</span>
          <span className="block text-sm text-muted-foreground">人物・章・関連する読書資料について相談できます</span>
        </span>
        <ChevronRight className="size-5 text-primary" />
      </Link>

      <section>
        <SectionTitle action={<Link href={`${base}/timeline`} className="text-sm text-primary">すべて</Link>}>🕰 最近の創作の動き</SectionTitle>
        <ol className="space-y-2">
          {timeline.slice(0, 6).map((e, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="w-12 shrink-0 text-xs text-muted-foreground tabular-nums">{format(e.date, "M/d")}</span>
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
        </ol>
      </section>

      <div className="space-y-2 pt-4">
        <Button asChild variant="outline" className="w-full">
          <Link href={`${base}/edit`}>作品情報を編集</Link>
        </Button>
        <DeleteProjectButton id={p.id} title={p.title} />
      </div>
    </div>
  );
}
