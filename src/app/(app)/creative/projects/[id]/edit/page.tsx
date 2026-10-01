import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectForm } from "@/components/creative/project-forms";
import { SectionTitle } from "@/components/books/bits";

export const metadata = { title: "作品情報を編集" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await prisma.novelProject.findUnique({ where: { id } });
  if (!p) notFound();
  return (
    <div className="mx-auto max-w-xl">
      <SectionTitle>作品情報を編集</SectionTitle>
      <ProjectForm
        id={p.id}
        initial={{ title: p.title, logline: p.logline ?? "", status: p.status, genre: p.genre ?? "", theme: p.theme ?? "", synopsis: p.synopsis ?? "" }}
      />
    </div>
  );
}
