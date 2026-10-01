/** OCR 動作確認用スクリプト：日本語テキスト画像を生成して tesseract.js で読み取る */
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { cleanOcrText } from "../src/lib/ocr/text";

async function makeImage(vertical: boolean) {
  const lines = ["人は、自分が思っているほど", "自分自身を知らない。"];
  const font = `font-family="Yu Mincho, MS Mincho, serif" font-size="44"`;
  let body = "";
  if (vertical) {
    // 縦書き：右の列から 1 文字ずつ配置
    lines.forEach((line, col) => {
      [...line].forEach((ch, i) => {
        body += `<text x="${520 - col * 70}" y="${70 + i * 50}" ${font}>${ch}</text>`;
      });
    });
    return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="760"><rect width="100%" height="100%" fill="#f6f1e7"/>${body}</svg>`)).png().toBuffer();
  }
  lines.forEach((line, i) => (body += `<text x="30" y="${80 + i * 70}" ${font}>${line}</text>`));
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="700" height="200"><rect width="100%" height="100%" fill="#f6f1e7"/>${body}</svg>`)).png().toBuffer();
}

async function main() {
  for (const vertical of [false, true]) {
    const img = await makeImage(vertical);
    const worker = await createWorker(vertical ? "jpn_vert" : "jpn");
    await worker.setParameters({ tessedit_pageseg_mode: (vertical ? "5" : "6") as never });
    const { data } = await worker.recognize(img);
    console.log(vertical ? "【縦書き】" : "【横書き】", "conf", Math.round(data.confidence));
    console.log("raw  :", JSON.stringify(data.text));
    console.log("clean:", JSON.stringify(cleanOcrText(data.text, { joinLines: true })));
    await worker.terminate();
  }
}
main();
