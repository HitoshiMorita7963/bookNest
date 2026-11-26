import { redirect } from "next/navigation";

/** 編集はフレーズの画面の中で行う（以前の /quotes/[id]/edit へのリンク用に転送だけ残す） */
export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/quotes/${id}?edit=1`);
}
