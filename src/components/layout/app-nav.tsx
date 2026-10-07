"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  Home,
  Library,
  Plus,
  PenSquare,
  Lightbulb,
  Brain,
  Menu,
  ScanBarcode,
  Search,
  PenLine,
  Camera,
  NotebookPen,
  BrainCircuit,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SIDEBAR_GROUPS, isActive } from "./nav-config";
import { Sheet, SheetContent } from "@/components/ui/overlays";
import { BookNestLogo } from "./logo";

function SidebarInner() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return (
    <nav aria-label="メインナビゲーション" className="flex flex-col gap-5 px-3 pb-6">
      {SIDEBAR_GROUPS.map((g, i) => (
        <div key={i} className="space-y-0.5">
          {g.title ? <p className="px-3 pb-1 text-xs font-medium tracking-wider text-muted-foreground">{g.title}</p> : null}
          {g.items.map((item) => {
            const active = isActive(item, pathname, search);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-lg px-3 text-[15px] transition-colors",
                  active ? "bg-primary/10 font-medium text-primary" : "text-foreground/80 hover:bg-accent",
                )}
              >
                <Icon className="size-[18px]" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto border-r bg-sidebar lg:flex">
      <Link href="/" className="flex h-16 items-center gap-2.5 px-6">
        <BookNestLogo className="size-8" />
        <span className="text-lg font-semibold tracking-tight">BookNest</span>
      </Link>
      <Link
        href="/books/new"
        className="mx-4 mb-5 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
      >
        <Plus className="size-5" aria-hidden />
        本を追加
      </Link>
      <Suspense>
        <SidebarInner />
      </Suspense>
    </aside>
  );
}

const ADD_ACTIONS = [
  { href: "/books/new?mode=scan", label: "バーコードで追加", desc: "カメラでISBNを読み取る", icon: ScanBarcode },
  { href: "/books/new?mode=search", label: "ISBN・タイトルで検索", desc: "書誌情報を自動取得", icon: Search },
  { href: "/books/new?mode=manual", label: "手入力で登録", desc: "すべて自分で入力", icon: PenLine },
  { href: "/quotes/new", label: "フレーズを撮影", desc: "カメラ → OCR → 保存", icon: Camera },
  { href: "/creative/notes/new", label: "創作メモ", desc: "思いついたアイデアをすぐ保存", icon: Lightbulb },
  { href: "/creative/projects/new", label: "小説プロジェクト", desc: "新しい作品を作る", icon: PenSquare },
  { href: "/knowledge/new", label: "知識を保存", desc: "読んで得た理解をまとめる", icon: Brain },
  { href: "/creative/knowledge/new", label: "創作知識", desc: "物語の型・演出などの知識を蓄える", icon: BrainCircuit },
  { href: "/reading", label: "読書の進捗・メモ", desc: "読書中の本を更新", icon: NotebookPen },
];

function BottomNavInner() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = [
    { href: "/", label: "ホーム", icon: Home, active: pathname === "/" },
    { href: "/books", label: "本棚", icon: Library, active: pathname.startsWith("/books") || pathname.startsWith("/reading") || pathname.startsWith("/tsundoku") || pathname.startsWith("/shelves") },
    null,
    { href: "/creative", label: "創作", icon: PenSquare, active: pathname.startsWith("/creative") },
    { href: "/more", label: "その他", icon: Menu, active: pathname.startsWith("/more") },
  ];
  return (
    <nav
      aria-label="ボトムナビゲーション"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
        {items.map((it) =>
          it === null ? (
            <li key="add" className="flex items-center justify-center">
              <Sheet open={open} onOpenChange={setOpen}>
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  aria-label="追加メニューを開く"
                  className="-mt-5 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95"
                >
                  <Plus className="size-7" />
                </button>
                <SheetContent title="追加する">
                  <ul className="grid gap-1.5">
                    {ADD_ACTIONS.map((a) => (
                      <li key={a.href}>
                        <Link
                          href={a.href}
                          onClick={() => setOpen(false)}
                          className="flex min-h-14 items-center gap-4 rounded-xl px-3 py-2.5 hover:bg-accent active:bg-accent"
                        >
                          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <a.icon className="size-5" />
                          </span>
                          <span>
                            <span className="block text-[15px] font-medium">{a.label}</span>
                            <span className="block text-sm text-muted-foreground">{a.desc}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </SheetContent>
              </Sheet>
            </li>
          ) : (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={it.active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-[11px]",
                  it.active ? "font-semibold text-primary" : "text-muted-foreground",
                )}
              >
                <it.icon className="size-6" strokeWidth={it.active ? 2.2 : 1.8} aria-hidden />
                {it.label}
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}

export function BottomNav() {
  return (
    <Suspense>
      <BottomNavInner />
    </Suspense>
  );
}

