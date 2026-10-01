import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { EmptyState, SectionTitle } from "@/components/books/bits";
import { CharacterSheetButton, DeleteItemButton, MoveButtons, RelationshipSheetButton } from "@/components/creative/project-forms";

export const metadata = { title: "人物" };

export default async function CharactersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [chars, rels] = await Promise.all([
    prisma.character.findMany({ where: { projectId: id }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], include: { _count: { select: { links: true } } } }),
    prisma.characterRelationship.findMany({ where: { projectId: id }, include: { from: { select: { id: true, name: true } }, to: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  return (
    <div className="space-y-8">
      <section>
        <SectionTitle action={<CharacterSheetButton projectId={id} />}>👤 人物 <span className="text-sm font-normal text-muted-foreground">{chars.length}人</span></SectionTitle>
        {chars.length === 0 ? (
          <EmptyState icon="👤" title="まだ人物がいません" description="主人公から書き始めてみましょう。名前と役割だけで追加できます。" />
        ) : (
          <ul className="space-y-2">
            {chars.map((c, i) => (
              <li key={c.id} className="flex items-center gap-2 rounded-2xl border bg-card p-2 pl-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary" aria-hidden>
                  {c.name.slice(0, 1)}
                </span>
                <Link href={`/creative/projects/${id}/characters/${c.id}`} className="min-w-0 flex-1 py-1">
                  <p className="truncate font-semibold">
                    {c.name}
                    {c.role ? <span className="ml-2 text-xs font-normal text-primary">{c.role}</span> : null}
                  </p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{[c.age, c.personality, c.goal].filter(Boolean).join(" ・ ") || "詳細は未入力"}</p>
                  {c._count.links ? <p className="text-xs text-muted-foreground">📚 参考資料 {c._count.links}</p> : null}
                </Link>
                <MoveButtons kind="character" id={c.id} first={i === 0} last={i === chars.length - 1} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle action={<RelationshipSheetButton projectId={id} characters={chars.map((c) => ({ id: c.id, name: c.name }))} />}>🔗 人物の関係</SectionTitle>
        {rels.length === 0 ? (
          <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">{chars.length < 2 ? "人物を2人以上追加すると、関係を登録できます。" : "「関係」から、恋愛・ライバル・幼馴染などの関係を登録できます。"}</p>
        ) : (
          <ul className="space-y-1.5">
            {rels.map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded-xl border bg-card p-2 pl-3 text-sm">
                <Link href={`/creative/projects/${id}/characters/${r.from.id}`} className="font-medium hover:underline">
                  {r.from.name}
                </Link>
                <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{r.label}</span>
                <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                <Link href={`/creative/projects/${id}/characters/${r.to.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                  {r.to.name}
                </Link>
                <DeleteItemButton kind="relationship" id={r.id} label="関係" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
