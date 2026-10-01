import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCharacter } from "@/server/services/novels";
import { describeSource } from "@/server/services/creative";
import { SectionTitle } from "@/components/books/bits";
import { CharacterSheetButton, DeleteItemButton } from "@/components/creative/project-forms";
import { LinkList } from "@/components/creative/note-client";
import { AddReferenceButton } from "@/components/creative/reference-picker";

const ICON = { book: "📚", quote: "💬", knowledge: "🧠", note: "💡" } as const;

export default async function CharacterPage({ params }: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await params;
  const c = await getCharacter(prisma, cid);
  if (!c || c.projectId !== id) notFound();
  const rows: [string, string | null][] = [
    ["役割", c.role],
    ["年齢", c.age],
    ["外見", c.appearance],
    ["性格", c.personality],
    ["過去", c.background],
    ["目的", c.goal],
    ["葛藤", c.conflict],
    ["話し方", c.speechStyle],
    ["メモ", c.notes],
  ];
  const values = Object.fromEntries(
    (["name", "role", "age", "appearance", "personality", "background", "goal", "conflict", "speechStyle", "notes"] as const).map((k) => [k, c[k] ?? ""]),
  );
  const materials = c.links.map((l) => {
    const s = describeSource(l);
    return { id: l.id, icon: ICON[s.kind], label: s.label, sub: s.sub, href: s.href, purpose: l.purpose };
  });
  const rels = [
    ...c.relationsFrom.map((r) => ({ id: r.id, label: r.label, other: r.to, dir: "→" })),
    ...c.relationsTo.map((r) => ({ id: r.id, label: r.label, other: r.from, dir: "←" })),
  ];
  return (
    <div className="space-y-6">
      <Link href={`/creative/projects/${id}/characters`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> 人物一覧
      </Link>
      <header className="flex items-center gap-3">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary" aria-hidden>
          {c.name.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold">{c.name}</h2>
          {c.role ? <p className="text-sm text-primary">{c.role}</p> : null}
        </div>
        <CharacterSheetButton projectId={id} character={{ id: c.id, ...values }} />
        <DeleteItemButton kind="character" id={c.id} label={`人物「${c.name}」`} redirectTo={`/creative/projects/${id}/characters`} />
      </header>
      <dl className="space-y-3">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="rounded-xl border bg-card p-3">
              <dt className="text-xs font-medium text-muted-foreground">{k}</dt>
              <dd className="prose-note mt-0.5 text-[15px]">{v}</dd>
            </div>
          ))}
      </dl>
      {rows.slice(1).every(([, v]) => !v) ? <p className="text-sm text-muted-foreground">鉛筆ボタンから、性格・目的・葛藤・過去・話し方などを書き足せます。</p> : null}
      {rels.length ? (
        <section>
          <SectionTitle>🔗 関係</SectionTitle>
          <ul className="space-y-1.5">
            {rels.map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
                <span className="text-muted-foreground">{r.dir}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{r.label}</span>
                <Link href={`/creative/projects/${id}/characters/${r.other.id}`} className="font-medium hover:underline">
                  {r.other.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <SectionTitle action={<AddReferenceButton projectId={id} fixedTarget={{ kind: "character", id: c.id, label: c.name }} />}>📚 参考にした読書資料・メモ</SectionTitle>
        <LinkList items={materials} empty="この人物のモデルや参考にした本・フレーズ・知識・創作メモを関連付けましょう。" />
      </section>
    </div>
  );
}
