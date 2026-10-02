"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteLinkAction } from "@/server/actions/creative";

/** 本・フレーズ・知識と創作（作品・人物・創作メモなど）の関連付けを解除する */
export function UnlinkCreativeButton({ linkId, label, className }: { linkId: string; label: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`「${label}」との関連付けを解除`}
      title="関連付けを解除"
      disabled={pending}
      className={className}
      onClick={() =>
        start(async () => {
          const res = await deleteLinkAction(linkId);
          if (!res.ok) return void toast.error(res.error);
          toast.success("関連付けを解除しました");
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
    </Button>
  );
}
