/**
 * 原稿（章・シーンの本文）の書き出し。
 * 本文には小説投稿サイトで一般的な記法を使える：
 *   ルビ  … |漢字《かんじ》（「|」は全角「｜」でも可）。「|」を省くと《》の直前の漢字の並びに振る
 *   傍点  … 《《強調》》
 */

export interface ManuscriptScene {
  title: string;
  content: string;
}
export interface ManuscriptChapter {
  title: string;
  scenes: ManuscriptScene[];
}
export interface Manuscript {
  title: string;
  logline: string | null;
  chapters: ManuscriptChapter[];
}
export interface ManuscriptOptions {
  /** シーン名を見出しとして入れる（入れない場合はシーンの間に「◇」を置く） */
  sceneTitles: boolean;
}

export type Inline = { text: string } | { base: string; ruby: string } | { emphasis: string };

const RUBY = /《《([^《》\n]+)》》|[|｜]([^|｜《》\n]+)《([^《》\n]+)》|([\p{Script=Han}々〆ヶ]+)《([^《》\n]+)》/gu;

/** 1行の本文を、ふつうの文字・ルビ・傍点に分ける */
export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of line.matchAll(RUBY)) {
    if (m.index > last) out.push({ text: line.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ emphasis: m[1] });
    else if (m[2] !== undefined) out.push({ base: m[2], ruby: m[3] });
    else out.push({ base: m[4], ruby: m[5] });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last) });
  return out;
}

/** 記法を取り除いた、読んだときの文字列（ルビは親文字だけ） */
export function plainLine(line: string): string {
  return parseInline(line)
    .map((s) => ("text" in s ? s.text : "base" in s ? s.base : s.emphasis))
    .join("");
}

/** 文字数（空白・改行と記法を除く。投稿サイトの文字数に近い数え方） */
export function countChars(content: string): number {
  return [...plainLine(content.replace(/\r\n?/g, "\n")).replace(/\s/g, "")].length;
}

export const bodyLines = (content: string) => content.replace(/\r\n?/g, "\n").replace(/^\n+|\s+$/g, "").split("\n");

/** 本文のあるシーンだけを残す（本文がまだない章は省く） */
export function writtenChapters(ms: Manuscript): ManuscriptChapter[] {
  return ms.chapters.map((c) => ({ ...c, scenes: c.scenes.filter((s) => s.content.trim()) })).filter((c) => c.scenes.length);
}

export function manuscriptStats(ms: Manuscript) {
  const scenes = ms.chapters.flatMap((c) => c.scenes);
  const written = scenes.filter((s) => s.content.trim());
  return { chapters: ms.chapters.length, scenes: scenes.length, written: written.length, chars: written.reduce((n, s) => n + countChars(s.content), 0) };
}

/**
 * テキスト（.txt）。記法はそのまま残す（投稿サイトに貼り付けるとルビ・傍点になる）。
 */
export function manuscriptText(ms: Manuscript, opts: ManuscriptOptions): string {
  const parts: string[] = [ms.title];
  if (ms.logline?.trim()) parts.push(ms.logline.trim());
  for (const c of writtenChapters(ms)) {
    parts.push("", "", c.title, "");
    c.scenes.forEach((s, i) => {
      if (opts.sceneTitles) parts.push(`◆${s.title}`, "");
      else if (i > 0) parts.push("◇", "");
      parts.push(...bodyLines(s.content), "");
    });
  }
  return parts.join("\n").replace(/\n{4,}/g, "\n\n\n").trimEnd() + "\n";
}

/** ダウンロードするファイル名（ファイル名に使えない文字を除く） */
export function manuscriptFileName(title: string, ext: string) {
  const safe = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").trim().slice(0, 60) || "原稿";
  return `${safe}.${ext}`;
}
