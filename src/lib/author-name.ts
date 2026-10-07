/**
 * 著者名の表記をそろえる。
 * - 姓と名の間のスペースは半角1つ（全角スペース・連続したスペース → 半角1つ）
 * - スペースのない日本語の名前（例：夏目漱石）は、どこで区切るかを機械的には決められないので、
 *   国立国会図書館などスペースありの表記（例：夏目 漱石）が見つかったときだけ、それに合わせる
 */

/** スペースを半角1つにそろえる */
export function normalizeAuthorName(name: string): string {
  return name.replace(/[\s　]+/g, " ").trim();
}

/** スペースを取り除いた形（同じ人かどうかの比較に使う） */
export function compactAuthorName(name: string): string {
  return name.replace(/[\s　]+/g, "");
}

/** スペースのない日本語の名前か（漢字・ひらがな・カタカナだけ。「・」を含む外国人名などは対象外） */
export function isUnspacedJapaneseName(name: string): boolean {
  return /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々]{2,}$/u.test(name);
}

/** スペースのない名前に合う、スペースありの表記を候補から探す（例：夏目漱石 と 夏目 漱石） */
export function findSpacedForm(name: string, candidates: string[]): string | null {
  const key = compactAuthorName(name);
  for (const c of candidates) {
    const n = normalizeAuthorName(c);
    if (n.includes(" ") && compactAuthorName(n) === key) return n;
  }
  return null;
}

/** 著者名の一覧をそろえる。spaced（NDL などの表記）にスペースありの同じ名前があれば、それに合わせる */
export function normalizeAuthorList(names: string[], spaced: string[] = []): string[] {
  const out: string[] = [];
  for (const raw of names) {
    let n = normalizeAuthorName(raw);
    if (!n) continue;
    if (!n.includes(" ")) n = findSpacedForm(n, spaced) ?? n;
    if (!out.some((x) => compactAuthorName(x) === compactAuthorName(n))) out.push(n);
  }
  return out;
}
