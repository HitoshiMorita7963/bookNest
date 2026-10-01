/**
 * OCR 結果の後処理（日本語向け）
 * Tesseract は日本語の文字間に空白を入れることがあるため除去し、
 * 段落内の不要な改行を整える。
 */
const CJK = "\\u3000-\\u303f\\u3040-\\u309f\\u30a0-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\uff00-\\uffef";
const CJK_SPACE = new RegExp(`([${CJK}])[ \\t]+(?=[${CJK}])`, "g");
const CJK_LATIN_SPACE_A = new RegExp(`([${CJK}])[ \\t]+(?=[0-9A-Za-z])`, "g");
const CJK_LATIN_SPACE_B = new RegExp(`([0-9A-Za-z])[ \\t]+(?=[${CJK}])`, "g");

export interface CleanOptions {
  /** 段落内の改行を連結する（文末記号で終わらない行を次の行とつなぐ） */
  joinLines?: boolean;
}

export function cleanOcrText(raw: string, opts: CleanOptions = {}): string {
  let t = raw.replace(/\r\n?/g, "\n");
  // 制御文字除去
  t = t.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  // 全角英数字を半角へ（記号・かなはそのまま）
  t = t.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  t = t.replace(CJK_SPACE, "$1");
  t = t.replace(CJK_SPACE, "$1"); // 連続した空白に対応するため2回
  t = t.replace(CJK_LATIN_SPACE_A, "$1").replace(CJK_LATIN_SPACE_B, "$1");
  // よくある誤認識
  t = t.replace(/[|｜](?=[぀-ヿ一-鿿])/g, "")
    .replace(/、、+/g, "、")
    .replace(/。。+/g, "。");
  const lines = t.split("\n").map((l) => l.trim());
  if (opts.joinLines) {
    const out: string[] = [];
    let buf = "";
    for (const line of lines) {
      if (!line) {
        if (buf) out.push(buf);
        buf = "";
        out.push("");
        continue;
      }
      buf = buf ? (/[a-zA-Z0-9,]$/.test(buf) && /^[a-zA-Z0-9]/.test(line) ? `${buf} ${line}` : buf + line) : line;
      if (/[。！？!?」』）)]$/.test(line)) {
        out.push(buf);
        buf = "";
      }
    }
    if (buf) out.push(buf);
    return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** 切り抜き範囲の縦横比から縦書きかどうかを推定 */
export function guessVertical(width: number, height: number) {
  return height > width * 1.15;
}
