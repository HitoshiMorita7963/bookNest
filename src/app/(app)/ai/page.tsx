import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { AiChat, type ChatMessage } from "@/components/ai/ai-chat";
import { ConversationHistoryButton, ConversationSidebar } from "@/components/ai/conversation-list";
import { aiAvailable, parseStoredSources } from "@/server/ai/librarian";

export const metadata = { title: "AI司書" };

export default async function AiPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const [convs, conv, status] = await Promise.all([
    prisma.aIConversation.findMany({ orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, title: true, updatedAt: true } }),
    c ? prisma.aIConversation.findUnique({ where: { id: c }, include: { messages: { orderBy: { createdAt: "asc" } } } }) : null,
    aiAvailable(prisma),
  ]);
  const items = convs.map((x) => ({ id: x.id, title: x.title, updatedAt: x.updatedAt.toISOString() }));
  const initial: ChatMessage[] = (conv?.messages ?? []).map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    sources: parseStoredSources(m.sources),
  }));
  return (
    <div>
      <PageHeader title="🤖 AI司書" subtitle={conv?.title} actions={<ConversationHistoryButton items={items} current={conv?.id ?? null} />} />
      <div className="flex gap-6">
        <ConversationSidebar items={items} current={conv?.id ?? null} />
        <div className="mx-auto w-full max-w-3xl min-w-0">
          <AiChat key={conv?.id ?? "new"} conversationId={conv?.id ?? null} initial={initial} status={{ ok: status.ok, reason: status.reason }} />
        </div>
      </div>
    </div>
  );
}
