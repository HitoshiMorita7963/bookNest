/** ISBN ユーティリティ（ハイフン除去・チェックディジット検証・10/13 変換） */

export function cleanIsbn(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[^0-9Xx]/g, "")
    .toUpperCase();
}

export function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const c = isbn[i];
    const v = c === "X" ? 10 : Number(c);
    sum += v * (10 - i);
  }
  return sum % 11 === 0;
}

export function isValidIsbn13(isbn: string): boolean {
  if (!/^\d{13}$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(isbn[12]);
}

export function isbn10to13(isbn10: string): string | null {
  if (!isValidIsbn10(isbn10)) return null;
  const body = "978" + isbn10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  return body + ((10 - (sum % 10)) % 10);
}

export function isbn13to10(isbn13: string): string | null {
  if (!isValidIsbn13(isbn13) || !isbn13.startsWith("978")) return null;
  const body = isbn13.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(body[i]) * (10 - i);
  const r = (11 - (sum % 11)) % 11;
  return body + (r === 10 ? "X" : String(r));
}

/** 入力から有効な ISBN-13 / ISBN-10 を得る。不正なら null */
export function parseIsbn(input: string): { isbn13: string; isbn10: string | null } | null {
  const c = cleanIsbn(input);
  if (c.length === 13 && isValidIsbn13(c)) return { isbn13: c, isbn10: isbn13to10(c) };
  if (c.length === 10 && isValidIsbn10(c)) {
    const i13 = isbn10to13(c);
    return i13 ? { isbn13: i13, isbn10: c } : null;
  }
  return null;
}

/** バーコードで読み取った EAN-13 が書籍 (978/979) かどうか */
export function isBookEan(code: string): boolean {
  return /^97[89]\d{10}$/.test(code) && isValidIsbn13(code);
}
