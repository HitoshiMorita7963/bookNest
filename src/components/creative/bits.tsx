import {
  CREATIVE_CATEGORIES,
  CREATIVE_CATEGORY_EMOJI,
  CREATIVE_CATEGORY_LABEL,
  NOTE_STATUS_LABEL,
  PROJECT_STATUS_LABEL,
  SCENE_STATUS_LABEL,
  type CreativeCategory,
  type NoteStatus,
  type ProjectStatus,
  type SceneStatus,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

const pill = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap";

export function CategoryBadge({ category, className }: { category: string; className?: string }) {
  const c = (CREATIVE_CATEGORIES as readonly string[]).includes(category) ? (category as CreativeCategory) : "OTHER";
  return (
    <span className={cn(pill, "bg-primary/10 text-primary", className)}>
      <span aria-hidden>{CREATIVE_CATEGORY_EMOJI[c]}</span>
      {CREATIVE_CATEGORY_LABEL[c]}
    </span>
  );
}

const NOTE_STATUS_COLOR: Record<NoteStatus, string> = {
  IDEA: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  IN_USE: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  USED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  ARCHIVED: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-200",
};
export function NoteStatusBadge({ status }: { status: string }) {
  const s = (status in NOTE_STATUS_LABEL ? status : "IDEA") as NoteStatus;
  return <span className={cn(pill, NOTE_STATUS_COLOR[s])}>{NOTE_STATUS_LABEL[s]}</span>;
}

const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
  IDEA: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  PLANNING: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  WRITING: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  ON_HOLD: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-200",
};
export function ProjectStatusBadge({ status }: { status: string }) {
  const s = (status in PROJECT_STATUS_LABEL ? status : "IDEA") as ProjectStatus;
  return <span className={cn(pill, PROJECT_STATUS_COLOR[s])}>{PROJECT_STATUS_LABEL[s]}</span>;
}

const SCENE_STATUS_COLOR: Record<SceneStatus, string> = {
  IDEA: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  OUTLINE: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  DRAFT: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  REVISED: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
};
export function SceneStatusBadge({ status }: { status: string }) {
  const s = (status in SCENE_STATUS_LABEL ? status : "IDEA") as SceneStatus;
  return <span className={cn(pill, SCENE_STATUS_COLOR[s])}>{SCENE_STATUS_LABEL[s]}</span>;
}

/** カテゴリを選ぶボタン群（スマホで押しやすい大きさ） */
export function CategoryChips({
  value,
  onChange,
  categories = CREATIVE_CATEGORIES,
}: {
  value: string;
  onChange: (c: CreativeCategory) => void;
  categories?: readonly CreativeCategory[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="カテゴリ">
      {categories.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          onClick={() => onChange(c)}
          className={cn(
            "flex h-10 items-center gap-1 rounded-full border px-3 text-sm transition-colors",
            value === c ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
          )}
        >
          <span aria-hidden>{CREATIVE_CATEGORY_EMOJI[c]}</span>
          {CREATIVE_CATEGORY_LABEL[c]}
        </button>
      ))}
    </div>
  );
}
