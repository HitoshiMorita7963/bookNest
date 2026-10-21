import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { sceneForWriting } from "@/server/services/writing";
import { SceneEditorClient as SceneEditor } from "@/components/writing/scene-editor-client";
import { aiAvailable } from "@/server/ai/librarian";
import { aiConfig } from "@/server/ai/config";

export const metadata = { title: "執筆" };

/** 執筆画面：アプリのメニューを出さず、本文だけに集中できる全画面のエディタ */
export default async function WritePage({ params }: { params: Promise<{ sid: string }> }) {
  const { sid } = await params;
  const [s, ai] = await Promise.all([sceneForWriting(prisma, sid), aiAvailable(prisma)]);
  if (!s) notFound();
  return (
    <SceneEditor
      // シーンを移動したら、入力中の状態を持ち越さないよう作り直す
      key={s.id}
      scene={{ id: s.id, title: s.title, status: s.status, content: s.content, updatedAt: s.updatedAt.toISOString() }}
      chapter={s.chapter}
      project={s.project}
      prev={s.prev}
      next={s.next}
      ai={{ ready: ai.ok, reason: ai.reason, providerLabel: aiConfig().providerLabel }}
    />
  );
}
