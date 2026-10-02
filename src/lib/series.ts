/**
 * シリーズ名・巻数の自動判定。
 * 「ノルウェイの森. 上」「One piece 巻1」「罪と罰（下）」「〇〇 第3巻」のようなタイトルや、
 * 国立国会図書館の巻次（「上巻」「巻一」）から、シリーズ名と巻数（数値）を取り出す。
 */

const KANJI_DIGIT: Record<string, number> = { 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

function kanjiToNumber(s: string): number | null {
  if (!/^[〇一二三四五六七八九十百]+$/.test(s)) return null;
  let total = 0;
  let cur = 0;
  for (const ch of s) {
    if (ch === "百") {
      total += (cur || 1) * 100;
      cur = 0;
    } else if (ch === "十") {
      total += (cur || 1) * 10;
      cur = 0;
    } else cur = cur * 10 + KANJI_DIGIT[ch];
  }
  return total + cur || null;
}

/** 巻次の文字列を数値に（「上」→1、「下巻」→2 or 3、「巻一」→1、「第12巻」→12）。判定できなければ null */
export function parseVolume(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.normalize("NFKC").trim().replace(/^[(（[]|[)）\]]$/g, "").trim();
  if (!s) return null;
  // 上・中・下（下は「上下」の2巻ものが多いので2。三部作の「中」は2・「下」は3になるが、上下巻の方が一般的）
  if (/^上(巻|編|冊)?$/.test(s)) return 1;
  if (/^中(巻|編|冊)?$/.test(s)) return 2;
  if (/^下(巻|編|冊)?$/.test(s)) return 2;
  if (/^前(巻|編|篇)$/.test(s)) return 1;
  if (/^後(巻|編|篇)$/.test(s)) return 2;
  const m = s.match(/^(?:第|巻|vol\.?|volume|no\.?|#)?\s*([0-9]+(?:\.[0-9]+)?|[〇一二三四五六七八九十百]+)\s*(?:巻|冊|部|集|号)?$/i);
  if (!m) return null;
  const n = /^[0-9.]+$/.test(m[1]) ? Number(m[1]) : kanjiToNumber(m[1]);
  return n !== null && n > 0 && n < 10000 ? n : null;
}

/** 出版社のレーベル名（〇〇文庫・〇〇新書・〇〇コミックスなど）。これは作品のシリーズとして扱わない */
export function isPublisherLabel(name: string | null | undefined): boolean {
  if (!name) return false;
  return /文庫|新書|選書|叢書|ライブラリ|ブックス|BOOKS|コミックス|COMICS|ノベルス|ノベルズ|NOVELS|単行本|全集/i.test(name);
}

/** タイトル末尾の巻表記を分ける。「ノルウェイの森. 上」→ { base: "ノルウェイの森", volume: 1, label: "上" } */
export function splitVolumeFromTitle(title: string): { base: string; volume: number; label: string } | null {
  const t = title.trim();
  const patterns = [
    /^(.+?)\s*[(（]\s*([^()（）]{1,8})\s*[)）]$/, // 罪と罰（下）・〇〇(3)
    /^(.+?)\s*[.．。,，]\s*(\S{1,8})$/, // ノルウェイの森. 上
    /^(.+?)\s+((?:第|巻|vol\.?\s*)?[0-9０-９〇一二三四五六七八九十百]+\s*(?:巻|冊)?)$/i, // One piece 巻1・〇〇 第3巻・〇〇 12
    /^(.+?)\s*(第[0-9０-９〇一二三四五六七八九十百]+巻)$/, // 〇〇第3巻
    /^(.+?)\s+([上中下](?:巻)?|[前後]編)$/, // 〇〇 上巻
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (!m) continue;
    const volume = parseVolume(m[2]);
    const base = m[1].trim();
    // 「AI 2041」のような年号・数字入りのタイトルを巻と誤認しないよう、巻・第などが付かない数字は300巻までとする
    const bareNumber = /^[0-9０-９]+$/.test(m[2].trim());
    if (volume !== null && base.length >= 1 && !(bareNumber && volume > 300)) return { base, volume, label: m[2].trim() };
  }
  return null;
}

/**
 * 書誌情報からシリーズ名と巻数を決める。
 * - 巻数：国立国会図書館の巻次 → タイトル末尾の巻表記
 * - シリーズ名：レーベルではないシリーズ名があればそれ、なければ（巻数があるときだけ）巻表記を除いたタイトル
 */
export function deriveSeries(m: { title: string; seriesTitle?: string | null; volume?: string | null }): { seriesTitle: string | null; seriesNumber: number | null } {
  let realSeries = m.seriesTitle && !isPublisherLabel(m.seriesTitle) ? m.seriesTitle.normalize("NFKC").split(/\s*;\s*/)[0].trim() : null;
  // 「ハリー・ポッターシリーズ 1」のようにシリーズ名に巻数が付いている場合
  const seriesSplit = realSeries ? splitVolumeFromTitle(realSeries) : null;
  if (seriesSplit) realSeries = seriesSplit.base;
  if (realSeries) realSeries = realSeries.replace(/\s*シリーズ$/, "") || realSeries;
  const split = splitVolumeFromTitle(m.title);
  const volume = parseVolume(m.volume) ?? split?.volume ?? seriesSplit?.volume ?? null;
  if (realSeries) return { seriesTitle: realSeries, seriesNumber: volume };
  if (volume === null) return { seriesTitle: null, seriesNumber: null };
  return { seriesTitle: split?.base ?? m.title.trim(), seriesNumber: volume };
}
