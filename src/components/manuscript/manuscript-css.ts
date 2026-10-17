/** 原稿の見た目：用紙・見出し・ルビ・傍点・縦書き（原稿ビューと執筆画面のプレビューで共用） */
export const MANUSCRIPT_CSS = `
.ms-paper { background: #fff; color: #1a1a1a; font-family: var(--font-serif); font-size: 16px; line-height: 1.9; }
.ms-paper p { margin: 0; text-align: justify; }
.ms-paper .ms-blank { min-height: 1.9em; min-width: 1.9em; }
.ms-paper h1 { font-size: 1.6em; font-weight: 700; text-align: center; margin: 3em 0 1em; }
.ms-paper .ms-logline { text-align: center; color: #555; }
.ms-paper h2 { font-size: 1.3em; font-weight: 700; margin: 2.5em 0 1.2em; }
.ms-paper h3 { font-size: 1.05em; font-weight: 700; margin: 2em 0 1em; }
.ms-paper .ms-break { text-align: center; margin: 1.2em 0; }
.ms-paper rt { font-size: 0.5em; }
.ms-paper .ms-emph { font-style: normal; text-emphasis: filled sesame; -webkit-text-emphasis: filled sesame; }
.ms-vertical { writing-mode: vertical-rl; height: 72dvh; overflow-x: auto; }
.ms-vertical h1, .ms-vertical .ms-logline { margin: 0 3em 0 1em; text-align: start; padding-top: 4em; }
.ms-vertical h2 { margin: 0 2em 0 1.5em; padding-top: 1em; }
.ms-vertical h3 { margin: 0 1.5em 0 1em; padding-top: 2em; }
.ms-vertical .ms-break { margin: 0 1em; }
@page { size: A5; margin: 16mm 15mm; }
@media print {
  html, body { background: #fff !important; }
  .ms-paper { font-size: 10pt; box-shadow: none !important; border: 0 !important; padding: 0 !important; border-radius: 0 !important; }
  .ms-paper h2 { break-before: page; }
  .ms-paper h2, .ms-paper h3 { break-after: avoid; }
  .ms-vertical { height: auto; overflow: visible; }
}
`;
