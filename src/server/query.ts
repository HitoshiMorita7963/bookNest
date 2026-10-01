import type { BookQuery } from "@/server/services/books";
import { SORT_OPTIONS, type SortKey } from "@/lib/constants";

type SP = Record<string, string | string[] | undefined>;

function str(sp: SP, k: string) {
  const v = sp[k];
  return typeof v === "string" && v.length <= 200 ? v : undefined;
}
function int(sp: SP, k: string) {
  const v = str(sp, k);
  if (!v) return undefined;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n < 1_000_000 ? n : undefined;
}

export function parseBookQuery(sp: SP): BookQuery {
  const sort = str(sp, "sort");
  const order = str(sp, "order");
  return {
    q: str(sp, "q"),
    status: str(sp, "status"),
    genre: str(sp, "genre"),
    tag: str(sp, "tag"),
    authorId: str(sp, "authorId"),
    shelfId: str(sp, "shelfId"),
    minRating: int(sp, "minRating"),
    publishedFrom: int(sp, "publishedFrom"),
    publishedTo: int(sp, "publishedTo"),
    finishedYear: int(sp, "finishedYear"),
    minPages: int(sp, "minPages"),
    maxPages: int(sp, "maxPages"),
    sort: sort && sort in SORT_OPTIONS ? (sort as SortKey) : undefined,
    order: order === "asc" || order === "desc" ? order : undefined,
    page: int(sp, "page") || 1,
  };
}

export function withParam(sp: SP, patch: Record<string, string | number | null>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") p.set(k, v);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) p.delete(k);
    else p.set(k, String(v));
  }
  return p.toString();
}
