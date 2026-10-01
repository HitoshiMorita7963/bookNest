"use client";

import { useState } from "react";
import Link from "next/link";
import { Dices, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { BookCover } from "@/components/books/book-cover";

interface Item {
  id: string;
  title: string;
  coverImage: string | null;
  author: string;
  days: number;
}

export function RandomPick({ items }: { items: Item[] }) {
  const [pick, setPick] = useState<Item | null>(null);
  const roll = () => {
    if (!items.length) return;
    let next = items[Math.floor(Math.random() * items.length)];
    if (items.length > 1 && next.id === pick?.id) next = items[(items.indexOf(next) + 1) % items.length];
    setPick(next);
  };
  return (
    <>
      <Button onClick={roll} disabled={!items.length} size="lg" className="w-full sm:w-auto">
        <Dices className="size-5" /> 積読からランダムに1冊
      </Button>
      <Dialog open={!!pick} onOpenChange={(o) => !o && setPick(null)}>
        <DialogContent title="今日はこの本はどうですか？">
          {pick ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-36">
                <BookCover src={pick.coverImage} title={pick.title} author={pick.author} />
              </div>
              <div>
                <p className="text-lg font-bold">『{pick.title}』</p>
                <p className="text-sm text-muted-foreground">{pick.author}</p>
                <p className="mt-1 text-xs text-muted-foreground">積読 {pick.days}日目</p>
              </div>
              <div className="grid w-full grid-cols-2 gap-2">
                <Button variant="outline" onClick={roll}>
                  <Dices /> もう一度
                </Button>
                <Button asChild>
                  <Link href={`/books/${pick.id}`}>
                    <BookOpen /> 開く
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
