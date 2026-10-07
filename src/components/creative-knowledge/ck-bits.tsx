import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TagChip } from "@/components/books/bits";
import { CK_CATEGORY_INFO, isCkCategory, lines } from "@/lib/creative-knowledge";
import { cn } from "@/lib/utils";

export function CkCategoryBadge({ category, className, link = false }: { category: string; className?: string; link?: boolean }) {
  const info = isCkCategory(category) ? CK_CATEGORY_INFO[category] : null;
  const cls = cn("inline-flex h-6 items-center gap-1 rounded-full bg-primary/10 px-2 text-xs font-medium text-primary", link && "hover:bg-primary/20", className);
  const body = (
    <>
      <span aria-hidden>{info?.emoji ?? "🧠"}</span>
      {info?.label ?? category}
    </>
  );
  return link && info ? (
    <Link href={`/creative/knowledge?category=${category}`} className={cls}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}

export interface CkCardData {
  id: string;
  title: string;
  category: string;
  subCategory: string | null;
  summary: string;
  isFavorite: boolean;
  categories: { category: string }[];
  tags: { tag: { name: string } }[];
}

/** 一覧のカード */
export function CkCard({ k, tagHref }: { k: CkCardData; tagHref?: (tag: string) => string }) {
  return (
    <li className="relative rounded-2xl border bg-card p-4 hover:bg-accent/30">
      <Link href={`/creative/knowledge/${k.id}`} className="absolute inset-0 rounded-2xl" aria-label={k.title} />
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">
          {k.title}
          {k.isFavorite ? (
            <span className="ml-1 text-amber-500" aria-label="お気に入り">
              ★
            </span>
          ) : null}
        </p>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <CkCategoryBadge category={k.category} />
        {k.subCategory ? <span className="text-xs text-muted-foreground">{k.subCategory}</span> : null}
        {k.categories.map((c) => (
          <CkCategoryBadge key={c.category} category={c.category} className="bg-secondary text-secondary-foreground" />
        ))}
      </div>
      {k.summary ? <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{k.summary}</p> : null}
      {k.tags.length ? (
        <div className="relative z-10 mt-2 flex flex-wrap gap-1.5">
          {k.tags.map((t) => (
            <TagChip key={t.tag.name} name={t.tag.name} href={tagHref?.(t.tag.name) ?? `/creative/knowledge?tag=${encodeURIComponent(t.tag.name)}`} />
          ))}
        </div>
      ) : null}
    </li>
  );
}

/** 「1行に1項目」のテキストを箇条書きで表示 */
export function ItemList({ text }: { text: string }) {
  const items = lines(text);
  if (!items.length) return null;
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-[15px] leading-relaxed">
          <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" />
          <span className="prose-note">{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** 感情・展開の流れ（1行に1段階）を矢印でつないで表示 */
export function FlowChain({ text }: { text: string }) {
  const steps = lines(text);
  if (!steps.length) return null;
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2" aria-label="流れ">
      {steps.map((s, i) => (
        <li key={i} className="flex items-center gap-1">
          <span className="rounded-lg border bg-card px-3 py-1.5 text-sm">{s}</span>
          {i < steps.length - 1 ? <ArrowRight aria-hidden className="size-4 text-muted-foreground" /> : null}
        </li>
      ))}
    </ol>
  );
}
