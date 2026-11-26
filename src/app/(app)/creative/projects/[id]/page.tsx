import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Bot, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { getProject, projectReferences, projectTimeline } from "@/server/services/novels";
import { projectToc } from "@/server/services/writing";
import { SectionTitle } from "@/components/books/bits";
import { Button } from "@/components/ui/button";
import { DeleteProjectButton } from "@/components/creative/project-forms";
import { SceneStatusBadge } from "@/components/creative/bits";
import { ResumeCard } from "@/components/writing/project-toc";
import { SCENE_STATUSES } from "@/lib/constants";

export const metadata = { title: "小説プロジェクト" };

/**
 * 作品の概要：作品の入口。「続きを書く」と進み具合、各タブへのカードを並べる。
 * 目次（章・シーンの一覧・並べ替え・書き出し）は「章・シーン」タブにまとめ、ここには出さない。
 */
export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, refs, timeline, toc] = await Promise.all([getProject(prisma, id), projectReferences(prisma, id), projectTimeline(prisma, id), projectToc(prisma, id)]);
  if (!p) notFound();
  const base = `/creative/projects/${p.id}`;
  const scenes = toc.chapters.flatMap((c) => c.scenes);
  const byStatus = SCENE_STATUSES.map((s) => ({ status: s, n: scenes.filter((x) => x.status === s).length })).filter((x) => x.n);
  const written = scenes.filter((s) => s.chars > 0).length;
  const sections = [
    { icon: "👤", label: "人物", value: `${p._count.characters}人`, href: `${base}/characters` },
    { icon: "🌍", label: "世界観", value: `${p._count.worldSettings}件`, href: `${base}/world` },
    { icon: "📋", label: "プロット", value: `${p._count.plots}件`, href: `${base}/plots` },
    { icon: "💡", label: "メモ", value: `${refs.counts.note}件`, href: `${base}/notes` },
    { icon: "📚", label: "参考資料", value: `${refs.counts.book + refs.counts.quote + refs.counts.knowledge}件`, href: `${base}/references` },
  ];
  const influence = [
    { icon: "📚", label: "本", n: refs.counts.book, unit: "冊", href: `${base}/references?type=book` },
    { icon: "💬", label: "フレーズ", n: refs.counts.quote, unit: "件", href: `${base}/references?type=quote` },
    { icon: "🧠", label: "知識", n: refs.counts.knowledge, unit: "件", href: `${base}/references?type=knowledge` },
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

      {/* 執筆：続きを書く・進み具合 → 目次は「章・シーン」タブ */}
      <section className="space-y-3" aria-label="執筆">
        <ResumeCard toc={toc} />
        <Link href={`${base}/chapters`} className="block rounded-2xl border bg-card p-4 hover:bg-accent/40">
          <div className="flex items-center gap-2">
            <span className="font-semibold">📖 章・シーン</span>
            <ChevronRight className="ml-auto size-5 text-muted-foreground" />
          </div>
          {toc.chapters.length ? (
            <>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {toc.totalChars.toLocaleString()}
                <span className="ml-0.5 text-sm font-normal text-muted-foreground">字</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {toc.chapters.length}章・{toc.sceneCount}シーン（本文あり {written}）
              </p>
              {byStatus.length ? (
                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="シーンの状態">
                  {byStatus.map((x) => (
                    <li key={x.status} className="flex items-center gap-1 text-xs">
                      <SceneStatusBadge status={x.status} />
                      <span className="tabular-nums">{x.n}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">章を作り、その中にシーンを並べて書いていきます。目次・並べ替え・書き出しもここから。</p>
          )}
        </Link>
      </section>

      <section>
        <SectionTitle>作品の設定と材料</SectionTitle>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {sections.map((x) => (
            <li key={x.label}>
              <Link href={x.href} className="flex items-center justify-between gap-2 rounded-xl border bg-card p-3 hover:bg-accent/40">
                <span className="text-sm">
                  {x.icon} {x.label}
                </span>
                <span className="font-semibold tabular-nums">{x.value}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>この作品に影響を与えた読書</SectionTitle>
        <ul className="grid grid-cols-3 gap-2">
          {influence.map((x) => (
            <li key={x.label}>
              <Link href={x.href} className="block rounded-xl border bg-card p-3 hover:bg-accent/40">
                <p className="text-xs text-muted-foreground">
                  {x.icon} {x.label}
                </p>
                <p className="text-2xl font-bold tabular-nums">
                  {x.n}
                  <span className="ml-0.5 text-xs font-normal text-muted-foreground">{x.unit}</span>
                </p>
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
        <SectionTitle
          action={
            <Link href={`${base}/timeline`} className="text-sm text-primary">
              すべて
            </Link>
          }
        >
          🕰 最近の創作の動き
        </SectionTitle>
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
