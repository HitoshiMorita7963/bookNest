/**
 * BookMetadataService
 * ISBN から書誌情報を取得する。プロバイダを差し替え・追加できるよう抽象化している。
 *  - openBD（日本の書籍に強い・キー不要）
 *  - 国立国会図書館サーチ OpenSearch（キー不要）
 *  - Google Books（キー任意: GOOGLE_BOOKS_API_KEY）
 */
import { parseIsbn } from "@/lib/isbn";

export interface BookMetadata {
  title: string;
  titleKana?: string | null;
  subtitle?: string | null;
  authors: string[];
  publisher?: string | null;
  publishedAt?: string | null;
  pageCount?: number | null;
  coverImage?: string | null;
  isbn13?: string | null;
  isbn10?: string | null;
  description?: string | null;
  language?: string | null;
  seriesTitle?: string | null;
  source: string;
}

export interface MetadataProvider {
  name: string;
  lookupIsbn(isbn13: string): Promise<BookMetadata | null>;
  search?(query: string): Promise<BookMetadata[]>;
}

const TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, headers: { "User-Agent": "BookNest/1.0", ...(init?.headers ?? {}) } });
  } finally {
    clearTimeout(t);
  }
}

function normalizeDate(s?: string | null): string | null {
  if (!s) return null;
  const t = s.trim();
  let m = t.match(/^(\d{4})(\d{2})(\d{2})$/) ?? t.match(/^(\d{4})[-./年](\d{1,2})[-./月](\d{1,2})/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    return Number(m[3]) >= 1 ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : `${m[1]}-${m[2].padStart(2, "0")}`;
  }
  m = t.match(/^(\d{4})(\d{2})$/) ?? t.match(/^(\d{4})[-./年](\d{1,2})/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${m[1]}-${m[2].padStart(2, "0")}`;
  m = t.match(/(\d{4})/);
  return m ? m[1] : null;
}

const CJK = /[぀-ヿ㐀-鿿]/;
function cleanAuthor(name: string): string {
  let n = name
    .replace(/\s*[／/]\s*(著|作|文|編|訳|監修|イラスト|絵|原作)$/, "")
    .replace(/[,，]\s*\d{3,4}-(\d{3,4})?\.?$/, "")
    .replace(/\s+(著|作|編|訳|監修)$/, "")
    .trim();
  if (CJK.test(n)) return n.replace(/\s*[，,]\s*/g, " ");
  // "Last, First" → "First Last"
  const parts = n.split(/\s*,\s*/);
  if (parts.length === 2) n = `${parts[1]} ${parts[0]}`;
  return n.replace(/\.$/, "");
}

function splitAuthors(raw?: string | null): string[] {
  if (!raw) return [];
  return Array.from(new Set(raw.split(/[／\/|]|\s{2,}/).map(cleanAuthor).filter(Boolean)));
}

// ---------- openBD ----------
interface OpenBdItem {
  summary?: { isbn?: string; title?: string; volume?: string; series?: string; publisher?: string; pubdate?: string; cover?: string; author?: string };
  onix?: {
    DescriptiveDetail?: {
      TitleDetail?: { TitleElement?: { Subtitle?: { content?: string }; TitleText?: { collationkey?: string } } };
      Extent?: { ExtentType?: string; ExtentValue?: string }[];
      Contributor?: { PersonName?: { content?: string }; ContributorRole?: string[] }[];
      Language?: { LanguageCode?: string }[];
    };
    CollateralDetail?: { TextContent?: { TextType?: string; Text?: string }[] };
  };
}

export const openBdProvider: MetadataProvider = {
  name: "openBD",
  async lookupIsbn(isbn13) {
    const res = await fetchWithTimeout(`https://api.openbd.jp/v1/get?isbn=${isbn13}`);
    if (!res.ok) return null;
    const json = (await res.json()) as (OpenBdItem | null)[];
    const item = json?.[0];
    if (!item?.summary?.title) return null;
    const s = item.summary;
    const dd = item.onix?.DescriptiveDetail;
    const pages = dd?.Extent?.find((e) => e.ExtentType === "11")?.ExtentValue;
    const texts = item.onix?.CollateralDetail?.TextContent ?? [];
    const desc = texts.find((t) => t.TextType === "03")?.Text ?? texts.find((t) => t.TextType === "02")?.Text ?? null;
    const contributors = dd?.Contributor?.map((c) => c.PersonName?.content).filter(Boolean) as string[] | undefined;
    const authors = contributors?.length ? contributors.map(cleanAuthor) : splitAuthors(s.author);
    return {
      title: [s.title, s.volume].filter(Boolean).join(" "),
      titleKana: dd?.TitleDetail?.TitleElement?.TitleText?.collationkey ?? null,
      subtitle: dd?.TitleDetail?.TitleElement?.Subtitle?.content ?? null,
      authors: Array.from(new Set(authors)),
      publisher: s.publisher ?? null,
      publishedAt: normalizeDate(s.pubdate),
      pageCount: pages ? Number(pages) || null : null,
      coverImage: s.cover || null,
      isbn13,
      description: desc,
      language: dd?.Language?.[0]?.LanguageCode === "eng" ? "en" : "ja",
      seriesTitle: s.series || null,
      source: "openBD",
    };
  },
};

// ---------- 国立国会図書館サーチ ----------
function xmlTag(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(decodeXml(m[1].trim()));
  return out;
}
function decodeXml(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

export const ndlProvider: MetadataProvider = {
  name: "NDL",
  async lookupIsbn(isbn13) {
    const res = await fetchWithTimeout(`https://ndlsearch.ndl.go.jp/api/opensearch?isbn=${isbn13}&cnt=5`);
    if (!res.ok) return null;
    const xml = await res.text();
    const items = xml.split("<item>").slice(1);
    const item = items[0];
    if (!item) return null;
    const title = xmlTag(item, "dc:title")[0] ?? xmlTag(item, "title")[0];
    if (!title) return null;
    const authors = xmlTag(item, "dc:creator").map(cleanAuthor).filter(Boolean);
    const titleKana = xmlTag(item, "dcndl:titleTranscription")[0] ?? null;
    const extent = items.map((it) => xmlTag(it, "dc:extent")[0]).find(Boolean) ?? "";
    const pageMatch = extent.match(/(\d+)\s*p/);
    return {
      title,
      titleKana,
      authors: Array.from(new Set(authors)),
      publisher: xmlTag(item, "dc:publisher")[0] ?? null,
      publishedAt: normalizeDate(xmlTag(item, "dcterms:issued")[0] ?? xmlTag(item, "dc:date")[0]),
      pageCount: pageMatch ? Number(pageMatch[1]) : null,
      coverImage: null,
      isbn13,
      description: null,
      seriesTitle: xmlTag(item, "dcndl:seriesTitle")[0] ?? null,
      source: "国立国会図書館",
    };
  },
};

// ---------- Google Books ----------
interface GVolume {
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    pageCount?: number;
    description?: string;
    language?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    industryIdentifiers?: { type: string; identifier: string }[];
  };
}

function fromGoogle(v: GVolume): BookMetadata | null {
  const i = v.volumeInfo;
  if (!i?.title) return null;
  const ids = i.industryIdentifiers ?? [];
  const thumb = i.imageLinks?.thumbnail ?? i.imageLinks?.smallThumbnail;
  return {
    title: i.title,
    subtitle: i.subtitle ?? null,
    authors: i.authors ?? [],
    publisher: i.publisher ?? null,
    publishedAt: normalizeDate(i.publishedDate),
    pageCount: i.pageCount ?? null,
    coverImage: thumb ? thumb.replace(/^http:/, "https:").replace("&edge=curl", "") : null,
    isbn13: ids.find((x) => x.type === "ISBN_13")?.identifier ?? null,
    isbn10: ids.find((x) => x.type === "ISBN_10")?.identifier ?? null,
    description: i.description ?? null,
    language: i.language ?? null,
    source: "Google Books",
  };
}

function googleUrl(q: string, max = 1) {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  return `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=${max}${key ? `&key=${encodeURIComponent(key)}` : ""}`;
}

export const googleBooksProvider: MetadataProvider = {
  name: "Google Books",
  async lookupIsbn(isbn13) {
    const res = await fetchWithTimeout(googleUrl(`isbn:${isbn13}`));
    if (!res.ok) return null;
    const json = (await res.json()) as { items?: GVolume[] };
    const v = json.items?.[0];
    return v ? fromGoogle(v) : null;
  },
  async search(query) {
    const res = await fetchWithTimeout(googleUrl(query, 20));
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: GVolume[] };
    return (json.items ?? []).map(fromGoogle).filter((x): x is BookMetadata => !!x);
  },
};

export class BookMetadataService {
  constructor(private providers: MetadataProvider[]) {}

  /** 各プロバイダの結果をマージし、欠けている項目を補完する */
  async lookupIsbn(isbnInput: string): Promise<BookMetadata | null> {
    const parsed = parseIsbn(isbnInput);
    if (!parsed) return null;
    let merged: BookMetadata | null = null;
    for (const p of this.providers) {
      let r: BookMetadata | null = null;
      try {
        r = await p.lookupIsbn(parsed.isbn13);
      } catch (e) {
        console.warn(`[metadata] ${p.name} failed:`, (e as Error).message);
      }
      if (!r) continue;
      if (!merged) {
        merged = { ...r };
      } else {
        for (const [k, v] of Object.entries(r) as [keyof BookMetadata, unknown][]) {
          const cur = merged[k];
          if ((cur === null || cur === undefined || cur === "" || (Array.isArray(cur) && cur.length === 0)) && v) {
            (merged as unknown as Record<string, unknown>)[k] = v;
          }
        }
      }
      if (merged.title && merged.authors.length && merged.pageCount && merged.coverImage && merged.description) break;
    }
    if (!merged) return null;
    merged.isbn13 = parsed.isbn13;
    merged.isbn10 = merged.isbn10 ?? parsed.isbn10;
    if (!merged.coverImage) merged.coverImage = await ndlThumbnail(parsed.isbn13);
    return merged;
  }

  async search(query: string): Promise<BookMetadata[]> {
    const q = query.trim();
    if (!q) return [];
    const parsed = parseIsbn(q);
    if (parsed) {
      const r = await this.lookupIsbn(parsed.isbn13);
      return r ? [r] : [];
    }
    for (const p of this.providers) {
      if (!p.search) continue;
      try {
        const r = await p.search(q);
        if (r.length) return r;
      } catch (e) {
        console.warn(`[metadata] ${p.name} search failed:`, (e as Error).message);
      }
    }
    return [];
  }
}

async function ndlThumbnail(isbn13: string): Promise<string | null> {
  const url = `https://ndlsearch.ndl.go.jp/thumbnail/${isbn13}.jpg`;
  try {
    const res = await fetchWithTimeout(url);
    const type = res.headers.get("content-type") ?? "";
    await res.body?.cancel();
    return res.ok && type.startsWith("image/") ? url : null;
  } catch {
    return null;
  }
}

export const bookMetadataService = new BookMetadataService([openBdProvider, ndlProvider, googleBooksProvider]);
