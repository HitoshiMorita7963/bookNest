"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncCkSeedsAction } from "@/server/actions/creative-knowledge";
import type { CkSeedStatus } from "@/server/services/creative-knowledge-seed";

/** 基本の創作知識（サンプル）の読み込み。まだ読み込んでいないもの・更新があるものがあるときだけ表示する */
export function CkSeedCard({ status }: { status: CkSeedStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!status.missing && !status.outdated) return null;
  const firstTime = status.missing === status.total;

  function load() {
    start(async () => {
      const res = await syncCkSeedsAction();
      if (!res.ok) return void toast.error(res.error);
      const { created, updated } = res.data;
      toast.success([created ? `${created}件を追加` : "", updated ? `${updated}件を更新` : ""].filter(Boolean).join("・") + "しました");
      router.refresh();
    });
  }

  return (
    <section aria-label="基本の創作知識" className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold">📦 基本の創作知識{firstTime ? `（${status.total}件）` : ""}</p>
        <p className="text-sm text-muted-foreground">
          {firstTime
            ? "三幕構成・伏線・敵から味方へ など、10カテゴリの基本的な創作知識をまとめて追加できます。あとから自由に編集できます。"
            : [status.missing ? `まだ追加していない知識が${status.missing}件` : "", status.outdated ? `内容が新しくなった知識が${status.outdated}件` : ""].filter(Boolean).join("、") +
              "あります。自分で編集した知識・お気に入り・自分のメモはそのまま残ります。"}
        </p>
      </div>
      <Button onClick={load} disabled={pending} className="shrink-0">
        {pending ? <Loader2 className="animate-spin" /> : <PackagePlus />} {firstTime ? "追加する" : "追加・更新する"}
      </Button>
    </section>
  );
}
