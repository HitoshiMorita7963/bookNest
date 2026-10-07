import {
  Home,
  Library,
  BookOpen,
  BookMarked,
  Bookmark,
  CheckCircle2,
  MessageSquareQuote,
  Brain,
  Network,
  BarChart3,
  Target,
  Route,
  Bot,
  Settings,
  Search,
  Users,
  Layers,
  FolderHeart,
  TrendingUp,
  Sparkles,
  CalendarDays,
  PenSquare,
  Lightbulb,
  NotebookPen,
  BrainCircuit,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 本棚のステータスフィルタ等、クエリ込みで一致判定する */
  match?: (pathname: string, search: string) => boolean;
}

export const SIDEBAR_GROUPS: { title?: string; items: NavItem[] }[] = [
  { items: [{ href: "/", label: "ホーム", icon: Home }, { href: "/search", label: "検索", icon: Search }] },
  {
    title: "本棚",
    items: [
      { href: "/books", label: "本棚", icon: Library, match: (p, s) => p === "/books" && !s.includes("status=") },
      { href: "/reading", label: "読書中", icon: BookOpen },
      { href: "/tsundoku", label: "積読", icon: BookMarked },
      { href: "/books?status=WANT_TO_READ", label: "読みたい", icon: Bookmark, match: (p, s) => p === "/books" && s.includes("status=WANT_TO_READ") },
      { href: "/books?status=COMPLETED", label: "読了", icon: CheckCircle2, match: (p, s) => p === "/books" && s.includes("status=COMPLETED") },
      { href: "/shelves", label: "マイ本棚", icon: FolderHeart },
      { href: "/authors", label: "著者", icon: Users },
      { href: "/series", label: "シリーズ", icon: Layers },
    ],
  },
  {
    title: "記録と知識",
    items: [
      { href: "/quotes", label: "フレーズ", icon: MessageSquareQuote },
      { href: "/knowledge", label: "知識", icon: Brain },
      { href: "/knowledge/map", label: "知識マップ", icon: Network },
    ],
  },
  {
    title: "創作",
    items: [
      { href: "/creative", label: "創作ホーム", icon: PenSquare },
      { href: "/creative/knowledge", label: "創作知識", icon: BrainCircuit },
      { href: "/creative/notes", label: "創作メモ", icon: Lightbulb },
      { href: "/creative/projects/new", label: "新しい小説", icon: NotebookPen },
    ],
  },
  {
    title: "振り返り",
    items: [
      { href: "/stats", label: "統計", icon: BarChart3 },
      { href: "/calendar", label: "読書カレンダー", icon: CalendarDays },
      { href: "/goals", label: "読書目標", icon: Target },
      { href: "/paths", label: "読書ルート", icon: Route },
      { href: "/insights", label: "読書傾向", icon: TrendingUp },
      { href: "/life", label: "私の読書人生", icon: Sparkles },
    ],
  },
  {
    items: [
      { href: "/ai", label: "AI司書", icon: Bot },
      { href: "/settings", label: "設定", icon: Settings },
    ],
  },
];

export function isActive(item: NavItem, pathname: string, search: string) {
  if (item.match) return item.match(pathname, search);
  if (item.href === "/") return pathname === "/";
  if (item.href === "/creative") return pathname === "/creative" || pathname.startsWith("/creative/projects/") && !pathname.startsWith("/creative/projects/new");
  if (item.href === "/knowledge") return pathname === "/knowledge" || (pathname.startsWith("/knowledge/") && !pathname.startsWith("/knowledge/map"));
  return pathname === item.href || pathname.startsWith(item.href + "/");
}
