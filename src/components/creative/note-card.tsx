import Link from "next/link";
import { format } from "date-fns";
import { CategoryBadge, NoteStatusBadge } from "./bits";
import { TagChip } from "@/components/books/bits";

export interface NoteCardData {
  id: string;
  title: string;
  content: string;
  category: string;
  status: string;
  updatedAt: Date;
  tags: { tag: { name: string } }[];
  usedIn: { project: { id: string; title: string } | null }[];
  _count: { materials: number; usedIn: number };
}

export function CreativeNoteCard({ note }: { note: NoteCardData }) {
  const projects = Array.from(new Map(note.usedIn.filter((u) => u.project).map((u) => [u.project!.id, u.project!.title])).values());
  return (
    <article className="relative rounded-2xl border bg-card p-4 hover:bg-accent/30">
      <Link href={`/creative/notes/${note.id}`} className="absolute inset-0 rounded-2xl" aria-label={`創作メモ「${note.title}」を開く`} />
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">💡 {note.title}</p>
        <NoteStatusBadge status={note.status} />
      </div>
      {note.content && note.content !== note.title ? <p className="prose-note mt-1.5 line-clamp-3 text-sm text-muted-foreground">{note.content}</p> : null}
      <div className="relative z-10 mt-2 flex flex-wrap items-center gap-1.5">
        <CategoryBadge category={note.category} />
        {note.tags.map((t) => (
          <TagChip key={t.tag.name} name={t.tag.name} />
        ))}
        {note._count.materials ? <span className="text-xs text-muted-foreground">📚 資料 {note._count.materials}</span> : null}
        <span className="ml-auto text-xs text-muted-foreground">{format(note.updatedAt, "yyyy/M/d")}</span>
      </div>
      {projects.length ? <p className="mt-1.5 truncate text-xs text-primary">✍️ {projects.join("、")}</p> : null}
    </article>
  );
}
