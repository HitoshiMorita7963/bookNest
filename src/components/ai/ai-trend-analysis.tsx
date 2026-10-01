"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { summarizeTrendsAction } from "@/server/actions/ai";

export function AiTrendAnalysis({ period }: { period: "3m" | "1y" | "all" }) {
  const [r, setR] = useState<{ overview: string; themes: string[]; suggestions: string[] } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="border-dashed border-primary/40">
      <CardHeader>
        <CardTitle>
          <Sparkles className="size-5 text-primary" /> AIによる読書傾向のまとめ
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {r ? (
          <>
            <p className="text-[15px] leading-relaxed">{r.overview}</p>
            {r.themes.length ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground">最近よく読んでいるテーマ</p>
                <p className="mt-1 text-sm">{r.themes.join(" ・ ")}</p>
              </div>
            ) : null}
            {r.suggestions.length ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground">これからの読書のヒント（AIの提案）</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {r.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">※ AIが集計データをもとに作成した文章です。推測を含む場合があります。</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">集計結果をAIが文章でまとめます（読書記録の集計値がAIプロバイダに送信されます）。</p>
        )}
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await summarizeTrendsAction(period);
              if (!res.ok) return void toast.error(res.error);
              setR(res.data);
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {r ? "もう一度まとめる" : "AIでまとめる"}
        </Button>
      </CardContent>
    </Card>
  );
}
