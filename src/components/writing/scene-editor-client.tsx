"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/primitives";

/** 執筆画面はこの端末に退避した下書き（localStorage）を最初に読むため、ブラウザだけで描画する */
export const SceneEditorClient = dynamic(() => import("./scene-editor").then((m) => m.SceneEditor), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-3xl space-y-3 p-4">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-[60dvh] w-full" />
    </div>
  ),
});
