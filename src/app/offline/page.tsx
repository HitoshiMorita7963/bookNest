import Link from "next/link";
import { BookNestLogo } from "@/components/layout/logo";

export const metadata = { title: "オフライン" };
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <BookNestLogo className="size-16" />
      <h1 className="text-xl font-bold">オフラインです</h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        ネットワークに接続されていません。以前に開いた本棚・本の詳細・読書記録・フレーズのページは、オフラインでも閲覧できます。
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {[
          ["/", "ホーム"],
          ["/books", "本棚"],
          ["/reading", "読書中"],
          ["/quotes", "フレーズ"],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="inline-flex h-11 items-center rounded-lg border bg-card px-4 text-sm hover:bg-accent">
            {label}
          </Link>
        ))}
      </div>
    </main>
  );
}
