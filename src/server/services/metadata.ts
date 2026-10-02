/**
 * BookMetadataService
 * ISBN から書誌情報を取得する。プロバイダを差し替え・追加できるよう抽象化している。
 *  - 楽天ブックス（表紙画像が最も充実・要 RAKUTEN_APP_ID / RAKUTEN_ACCESS_KEY）
 *  - openBD（日本の書籍に強い・キー不要）
 *  - 国立国会図書館サーチ OpenSearch（キー不要）
 *  - Google Books（キー任意: GOOGLE_BOOKS_API_KEY）
 */
import { parseIsbn } from "@/lib/isbn";
import { parseVolume } from "@/lib/series";

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
  /** 巻次（「上」「巻一」「3」など。シリーズの巻数の判定に使う） */
  volume?: string | null;
  /** 日本十進分類（国立国会図書館。ジャンル推定に使う） */
  ndc?: string | null;
  /** 件名（国立国会図書館） */
  subjects?: string[];
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

// ---------- 楽天ブックス（RAKUTEN_APP_ID + RAKUTEN_ACCESS_KEY） ----------
interface RakutenItem {
  title?: string;
  titleKana?: string;
  subTitle?: string;
  seriesName?: string;
  author?: string;
  publisherName?: string;
  isbn?: string;
  itemCaption?: string;
  salesDate?: string;
  largeImageUrl?: string;
  mediumImageUrl?: string;
}

export function rakutenConfigured() {
  return !!process.env.RAKUTEN_APP_ID?.trim() && !!process.env.RAKUTEN_ACCESS_KEY?.trim();
}

/** 楽天の画像は ?_ex=200x200 で縮小されているので、大きめのサイズを指定し直す。画像なしの代替画像は除外 */
export function rakutenCover(url?: string | null): string | null {
  if (!url || /noimage/i.test(url)) return null;
  return url.replace(/^http:/, "https:").replace(/_ex=\d+x\d+/, "_ex=400x400");
}

function fromRakuten(it: RakutenItem): BookMetadata | null {
  if (!it.title) return null;
  const isbn = it.isbn?.replace(/[^0-9X]/gi, "") || null;
  return {
    title: it.title,
    titleKana: it.titleKana || null,
    subtitle: it.subTitle || null,
    authors: splitAuthors(it.author),
    publisher: it.publisherName || null,
    publishedAt: normalizeDate(it.salesDate?.replace(/頃$/, "")),
    coverImage: rakutenCover(it.largeImageUrl || it.mediumImageUrl),
    isbn13: isbn && isbn.length === 13 ? isbn : null,
    description: it.itemCaption || null,
    language: "ja",
    seriesTitle: it.seriesName || null,
    source: "楽天ブックス",
  };
}

async function rakutenSearch(params: Record<string, string>, hits = 1): Promise<BookMetadata[]> {
  // 2026年以降の楽天APIはアプリID と アクセスキーの両方が必要
  if (!rakutenConfigured()) return [];
  const appId = process.env.RAKUTEN_APP_ID!.trim();
  const qs = new URLSearchParams({ applicationId: appId, format: "json", formatVersion: "2", hits: String(hits), ...params });
  const accessKey = process.env.RAKUTEN_ACCESS_KEY?.trim();
  if (accessKey) qs.set("accessKey", accessKey);
  // 楽天は「許可されたWebサイト」に登録したURLを Origin / Referer として送る必要がある
  const appUrl = process.env.RAKUTEN_ALLOWED_URL?.trim() || process.env.APP_URL?.trim();
  const res = await fetchWithTimeout(`https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404?${qs}`, {
    headers: appUrl ? { Referer: appUrl, Origin: new URL(appUrl).origin } : {},
  });
  if (!res.ok) {
    console.warn(`[metadata] 楽天ブックス HTTP ${res.status}${appUrl ? "" : "（APP_URL が未設定です。楽天の『許可されたWebサイト』と同じURLを設定してください）"}`);
    return [];
  }
  const json = (await res.json()) as { Items?: (RakutenItem | { Item?: RakutenItem })[] };
  return (json.Items ?? [])
    .map((x) => ("Item" in x && x.Item ? x.Item : (x as RakutenItem)))
    .map(fromRakuten)
    .filter((x): x is BookMetadata => !!x);
}

export const rakutenProvider: MetadataProvider = {
  name: "楽天ブックス",
  async lookupIsbn(isbn13) {
    return (await rakutenSearch({ isbn: isbn13 }))[0] ?? null;
  },
  async search(query) {
    return rakutenSearch({ title: query }, 20);
  },
};

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
      // summary.volume には文庫の整理番号（例「な31-3」）が入っていることがあるので、巻表記のときだけタイトルに付ける
      title: [s.title, parseVolume(s.volume) !== null ? s.volume : null].filter(Boolean).join(" "),
      volume: parseVolume(s.volume) !== null ? s.volume : null,
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

/** 日本十進分類（新しい版を優先）。同じ本の複数の書誌レコードから探す */
function ndcOf(items: string[]): string | null {
  for (const ver of ["NDC10", "NDC9", "NDC8", "NDC"]) {
    for (const it of items) {
      const m = it.match(new RegExp(`<dc:subject xsi:type="dcndl:${ver}">([^<]+)</dc:subject>`));
      if (m) return m[1].trim();
    }
  }
  return null;
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
      volume: xmlTag(item, "dcndl:volume")[0] || null,
      ndc: ndcOf(items),
      subjects: Array.from(new Set(items.flatMap((it) => xmlTag(it, "dc:subject")).filter((s) => !/^[\dA-Z]/.test(s)))).slice(0, 8),
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
    if (!merged.coverImage) merged.coverImage = await this.findCover(parsed.isbn13, merged.title, true, merged.authors);
    return merged;
  }

  /**
   * 表紙画像だけを探す（一括取得用）。
   * 楽天 → openBD → 国立国会図書館のサムネイル → Google Books（タイトル検索してISBNが一致したもの）の順。
   * skipProviders=true のときは lookupIsbn で既に各プロバイダを試した後なので、残りだけを試す。
   */
  async findCover(isbn13: string, title?: string | null, skipProviders = false, authors: string[] = []): Promise<string | null> {
    if (!skipProviders) {
      for (const p of this.providers) {
        if (p === googleBooksProvider || p === ndlProvider) continue;
        try {
          const r = await p.lookupIsbn(isbn13);
          if (r?.coverImage) return r.coverImage;
        } catch (e) {
          console.warn(`[metadata] ${p.name} failed:`, (e as Error).message);
        }
      }
    }
    const ndl = await ndlThumbnail(isbn13);
    if (ndl) return ndl;
    return title ? googleCoverByTitle(title, isbn13, authors) : null;
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

const squash = (s: string) => s.normalize("NFKC").replace(/[\s・、。,.:：!！?？「」『』]/g, "").toLowerCase();

/**
 * Google Books は日本の本を ISBN で引けないことが多いので、タイトルで探して表紙を使う。
 * ISBN が一致したものを優先し、なければ「タイトルが完全に一致し、著者も一致する」もの（電子書籍版など）を使う。
 */
async function googleCoverByTitle(title: string, isbn13: string, authors: string[] = []): Promise<string | null> {
  // 副題・文庫の整理番号（例「せ8-3」）を外して検索する
  const t = title.split(/\s+[:：]\s*|[（(]/)[0].replace(/\s+\S{1,3}\d+-\d+$/, "").trim() || title;
  try {
    const res = await fetchWithTimeout(googleUrl(`intitle:${t}`, 20));
    if (!res.ok) return null;
    const json = (await res.json()) as { items?: GVolume[] };
    const isbn10 = parseIsbn(isbn13)?.isbn10;
    const found = (json.items ?? []).map(fromGoogle).filter((m): m is BookMetadata => !!m?.coverImage);
    const byIsbn = found.find((m) => m.isbn13 === isbn13 || (isbn10 && m.isbn10 === isbn10));
    if (byIsbn) return byIsbn.coverImage!;
    const wantAuthors = authors.map(squash).filter(Boolean);
    if (!wantAuthors.length) return null;
    const byTitle = found.find(
      (m) => squash(m.title) === squash(t) && m.authors.some((a) => wantAuthors.some((w) => squash(a).includes(w) || w.includes(squash(a)))),
    );
    return byTitle?.coverImage ?? null;
  } catch {
    /* 見つからなければ諦める */
  }
  return null;
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

export const bookMetadataService = new BookMetadataService([rakutenProvider, openBdProvider, ndlProvider, googleBooksProvider]);
