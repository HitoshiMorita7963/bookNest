/** フレーズを囲む引用符（表示・共有・創作メモの下書きで共通） */
export const QUOTE_OPEN = "“";
export const QUOTE_CLOSE = "”";

export function quoted(text: string): string {
  return `${QUOTE_OPEN}${text}${QUOTE_CLOSE}`;
}
