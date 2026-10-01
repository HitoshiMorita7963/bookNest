import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { EditorChat, type EditorMessage } from "@/components/ai/editor-chat";
import { aiAvailable } from "@/server/ai/librarian";

export const metadata = { title: "AI編集者" };

export default async function EditorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ c?: string }> }) {
  const { id } = await params;
  const { c } = await searchParams;
  const [project, conversations, conv, status] = await Promise.all([
    prisma.novelProject.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        chapters: { select: { id: true, title: true }, orderBy: { position: "asc" } },
        characters: { select: { id: true, name: true, role: true }, orderBy: { position: "asc" } },
      },
    }),
    prisma.aIConversation.findMany({ where: { projectId: id }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, title: true, updatedAt: true } }),
    c ? prisma.aIConversation.findFirst({ where: { id: c, projectId: id }, include: { messages: { orderBy: { createdAt: "asc" } } } }) : null,
    aiAvailable(prisma),
  ]);
  if (!project) notFound();
  const initial: EditorMessage[] = (conv?.messages ?? []).map((m) => {
    let sources: EditorMessage["sources"] = null;
    try {
      sources = m.sources ? JSON.parse(m.sources) : null;
    } catch {
      sources = null;
    }
    if (sources && !sources.creative) sources = { ...sources, creative: [] };
    return { id: m.id, role: m.role as "user" | "assistant", content: m.content, sources };
  });
  return (
    <EditorChat
      key={conv?.id ?? "new"}
      projectId={project.id}
      projectTitle={project.title}
      conversationId={conv?.id ?? null}
      initial={initial}
      chapters={project.chapters}
      characters={project.characters}
      status={{ ok: status.ok, reason: status.reason }}
      conversations={conversations.map((x) => ({ id: x.id, title: x.title, updatedAt: x.updatedAt.toISOString() }))}
    />
  );
}
