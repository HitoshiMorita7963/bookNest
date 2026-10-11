/**
 * 原稿の書き出し：章・シーンの本文を1つのファイルにまとめる。
 * Word 形式（.docx）は Google ドキュメントでもそのまま開ける（章は見出し1、シーン名は見出し2 になり、目次・アウトラインに出る）。
 */
import JSZip from "jszip";
import type { Db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { bodyLines, parseInline, writtenChapters, type Manuscript, type ManuscriptOptions } from "@/lib/manuscript";

export async function getManuscript(db: Db, projectId: string): Promise<Manuscript> {
  const p = await db.novelProject.findUnique({
    where: { id: projectId },
    select: {
      title: true,
      logline: true,
      chapters: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { title: true, scenes: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { title: true, content: true } } },
      },
    },
  });
  if (!p) throw new NotFoundError("作品");
  return { title: p.title, logline: p.logline, chapters: p.chapters.map((c) => ({ title: c.title, scenes: c.scenes.map((s) => ({ title: s.title, content: s.content ?? "" })) })) };
}

// ---- Word（.docx） ----

/** XML に書けない制御文字を除いてエスケープする */
const esc = (s: string) =>
  s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const run = (text: string, props = "") => `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;

/** 1行の本文 → 段落。ルビは Word のルビ、傍点は圏点にする */
function bodyParagraph(line: string) {
  const runs = parseInline(line)
    .map((s) => {
      if ("text" in s) return run(s.text);
      if ("emphasis" in s) return run(s.emphasis, '<w:em w:val="dot"/>');
      return `<w:r><w:ruby><w:rubyPr><w:rubyAlign w:val="center"/><w:hps w:val="10"/><w:hpsRaise w:val="20"/><w:hpsBaseText w:val="21"/><w:lid w:val="ja-JP"/></w:rubyPr><w:rt>${run(s.ruby, '<w:sz w:val="10"/>')}</w:rt><w:rubyBase>${run(s.base)}</w:rubyBase></w:ruby></w:r>`;
    })
    .join("");
  return `<w:p>${runs}</w:p>`;
}

const styled = (style: string, text: string) => `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${run(text)}</w:p>`;

function documentXml(ms: Manuscript, opts: ManuscriptOptions) {
  const body: string[] = [styled("Title", ms.title)];
  if (ms.logline?.trim()) body.push(styled("Subtitle", ms.logline.trim()));
  for (const c of writtenChapters(ms)) {
    body.push(styled("Heading1", c.title));
    c.scenes.forEach((s, i) => {
      if (opts.sceneTitles) body.push(styled("Heading2", s.title));
      else if (i > 0) body.push(styled("SceneBreak", "◇"));
      body.push(...bodyLines(s.content).map(bodyParagraph));
    });
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1701" w:right="1418" w:bottom="1701" w:left="1418" w:header="851" w:footer="992" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

const FONT = '<w:rFonts w:ascii="Yu Mincho" w:hAnsi="Yu Mincho" w:eastAsia="Yu Mincho"/>';
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>${FONT}<w:sz w:val="21"/><w:lang w:val="en-US" w:eastAsia="ja-JP"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:jc w:val="center"/><w:spacing w:before="2400" w:after="480"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:color w:val="555555"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:pageBreakBefore/><w:keepNext/><w:spacing w:before="480" w:after="480"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="240"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="SceneBreak"><w:name w:val="Scene Break"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="240"/></w:pPr></w:style>
</w:styles>`;

export async function manuscriptDocx(ms: Manuscript, opts: ManuscriptOptions): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
  );
  zip.file(
    "docProps/core.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(ms.title)}</dc:title></cp:coreProperties>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  zip.file("word/styles.xml", STYLES);
  zip.file("word/document.xml", documentXml(ms, opts));
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
