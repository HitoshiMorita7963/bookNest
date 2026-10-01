import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { listCreativeNotes } from "@/server/services/creative";
import { EmptyState, SectionTitle } from "@/components/books/bits";
import { Button } from "@/components/ui/button";
import { CreativeNoteCard } from "@/components/creative/note-card";
import { AddReferenceButton } from "@/components/creative/reference-picker";

export const metadata = { title: "作品の創作メモ" };

export default async function ProjectNotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { items } = await listCreativeNotes(prisma, { projectId: id });
  return (
    <section>
      <SectionTitle
        action={
          <div className="flex gap-2">
            <AddReferenceButton projectId={id} label="既存メモ" />
            <Button asChild size="sm">
              <Link href={`/creative/notes/new?projectId=${id}`}>
                <Plus /> メモ
              </Link>
            </Button>
          </div>
        }
      >
        💡 この作品の創作メモ
      </SectionTitle>
      {items.length === 0 ? (
        <EmptyState icon="💡" title="この作品の創作メモはまだありません" description="思いついたセリフ・描写・場面のアイデアをメモしておくと、AI編集者からも探せます。" />
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <CreativeNoteCard key={n.id} note={n} />
          ))}
        </div>
      )}
    </section>
  );
}
