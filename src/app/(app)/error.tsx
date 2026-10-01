"use client";

import { useEffect } from "react";
import { EmptyState } from "@/components/books/bits";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="pt-10">
      <EmptyState
        icon="⚠️"
        title="読み込み中に問題が発生しました"
        description="時間をおいて再度お試しください。問題が続く場合はアプリを再起動してください。"
        action={<Button onClick={reset}>再読み込み</Button>}
      />
    </div>
  );
}
