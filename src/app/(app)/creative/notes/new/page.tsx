import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { NoteForm } from "@/components/creative/note-form";
import { CREATIVE_CATEGORIES, type CreativeCategory } from "@/lib/constants";

export const metadata = { title: "創作メモ" };

export default async function NewCreativeNotePage({ searchParams }: { searchParams: Promise<{ category?: string; projectId?: string }> }) {
  const sp = await searchParams;
  const category = (CREATIVE_CATEGORIES as readonly string[]).includes(sp.category ?? "") ? (sp.category as CreativeCategory) : "OTHER";
  // 作品の画面から作成した場合は、その作品に追加する
  const project = sp.projectId ? await prisma.novelProject.findUnique({ where: { id: sp.projectId }, select: { id: true, title: true } }) : null;
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="💡 創作メモ" back />
      {project ? <p className="mb-4 rounded-xl bg-muted/60 p-3 text-sm">✍️ 『{project.title}』のメモとして保存します</p> : null}
      <NoteForm initial={{ category }} link={project ? { target: { kind: "project", id: project.id } } : undefined} />
    </div>
  );
}
