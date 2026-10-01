/** サーバーOCRルート（/api/ocr）の動作確認 */
import sharp from "sharp";
import { GET, POST } from "../src/app/api/ocr/route";

async function main() {
  process.env.OCR_PROVIDER = "google-vision";
  console.log("GET", await (await GET()).json());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="700"><rect width="100%" height="100%" fill="#fff"/>${[..."縦書きの文章です。"].map((c, i) => `<text x="130" y="${70 + i * 60}" font-family="Yu Mincho, serif" font-size="48">${c}</text>`).join("")}</svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const fd = new FormData();
  fd.append("file", new File([new Uint8Array(png)], "t.png", { type: "image/png" }));
  fd.append("direction", "vertical");
  const res = await POST(new Request("http://x/api/ocr", { method: "POST", body: fd }));
  console.log("POST", res.status, await res.json());
}
main();
