import Link from "next/link";
import { EmptyState } from "@/components/books/bits";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="pt-10">
      <EmptyState
        icon="📭"
        title="ページが見つかりませんでした"
        description="削除されたか、URLが間違っている可能性があります。"
        action={
          <Button asChild>
            <Link href="/">ホームへ戻る</Link>
          </Button>
        }
      />
    </div>
  );
}
