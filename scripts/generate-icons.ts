/** PWA アイコン生成：npx tsx scripts/generate-icons.ts */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const BG = "#1f4f99";
const PAPER = "#f6f9ff";
const ACCENT = "#e3b25a";

/** 開いた本と、その下の「巣（nest）」を表す曲線 */
function svg(size: number, { maskable = false, rounded = true } = {}) {
  const pad = maskable ? 0.2 : 0.12; // maskable はセーフゾーン（中央80%）に収める
  const s = size;
  const inner = s * (1 - pad * 2);
  const ox = s * pad;
  const oy = s * pad;
  const u = inner / 64;
  const r = rounded && !maskable ? s * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${r}" fill="${BG}"/>
  <g transform="translate(${ox} ${oy + u * 2}) scale(${u})">
    <path d="M8 46c8-4 16-4 24 0 8-4 16-4 24 0V14c-8-4-16-4-24 0-8-4-16-4-24 0z" fill="${PAPER}" />
    <path d="M32 14v32" stroke="${BG}" stroke-width="2.4" />
    <path d="M14 22c4-1.5 8-1.5 12 0M14 29c4-1.5 8-1.5 12 0M14 36c4-1.5 8-1.5 12 0M38 22c4-1.5 8-1.5 12 0M38 29c4-1.5 8-1.5 12 0M38 36c4-1.5 8-1.5 12 0" stroke="${BG}" stroke-opacity="0.35" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M6 53c17 7 35 7 52 0" fill="none" stroke="${ACCENT}" stroke-width="4" stroke-linecap="round"/>
  </g>
</svg>`;
}

async function main() {
  const out = path.join(process.cwd(), "public", "icons");
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, "icon.svg"), svg(512));
  const jobs: [string, number, Parameters<typeof svg>[1]][] = [
    ["icon-192.png", 192, {}],
    ["icon-512.png", 512, {}],
    ["icon-maskable-512.png", 512, { maskable: true }],
    ["icon-maskable-192.png", 192, { maskable: true }],
    ["apple-touch-icon.png", 180, { rounded: false }],
    ["favicon-32.png", 32, {}],
  ];
  for (const [name, size, opts] of jobs) {
    await sharp(Buffer.from(svg(size, opts))).png().toFile(path.join(out, name));
    console.log("✓", name);
  }
  await sharp(Buffer.from(svg(48))).resize(32, 32).png().toFile(path.join(process.cwd(), "src", "app", "icon.png"));
  console.log("✓ src/app/icon.png");
}
main();
