import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { NoteForm } from "@/components/creative/note-form";
import type { CreativeCategory, NoteStatus } from "@/lib/constants";

export const metadata = { title: "創作メモを編集" };

export default async function EditCreativeNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = await prisma.creativeNote.findUnique({ where: { id }, include: { tags: { include: { tag: true } } } });
  if (!n) notFound();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="創作メモを編集" back />
      <NoteForm
        noteId={n.id}
        initial={{ title: n.title, content: n.content, category: n.category as CreativeCategory, status: n.status as NoteStatus, tags: n.tags.map((t) => t.tag.name).join("、") }}
      />
    </div>
  );
}
