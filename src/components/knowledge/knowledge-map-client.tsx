"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/primitives";

/** レイアウト計算の浮動小数点誤差によるハイドレーション不一致を避けるため、クライアントのみで描画 */
export const KnowledgeMapClient = dynamic(() => import("./knowledge-map").then((m) => m.KnowledgeMap), {
  ssr: false,
  loading: () => <Skeleton className="h-[62dvh] w-full rounded-2xl md:h-[560px]" />,
});
