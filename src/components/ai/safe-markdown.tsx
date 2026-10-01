import { Fragment } from "react";

/**
 * AI の回答を表示するための最小限の Markdown レンダラー。
 * HTML を挿入せず React 要素として組み立てるため、XSS の心配がない。
 * 対応：段落、箇条書き（- / ・ / 1.）、**太字**
 */
function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") && p.length > 4 ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>));
}

export function SafeMarkdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ({ type: "p"; lines: string[] } | { type: "ul" | "ol"; items: string[] })[] = [];
  for (const raw of lines) {
    const line = raw.replace(/^#{1,6}\s+/, "");
    const ul = line.match(/^\s*(?:[-*・])\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const last = blocks[blocks.length - 1];
    if (ul) {
      if (last?.type === "ul") last.items.push(ul[1]);
      else blocks.push({ type: "ul", items: [ul[1]] });
    } else if (ol) {
      if (last?.type === "ol") last.items.push(ol[1]);
      else blocks.push({ type: "ol", items: [ol[1]] });
    } else if (!line.trim()) {
      blocks.push({ type: "p", lines: [] });
    } else if (last?.type === "p" && last.lines.length) {
      last.lines.push(line);
    } else {
      blocks.push({ type: "p", lines: [line] });
    }
  }
  return (
    <div className={className}>
      {blocks.map((b, i) =>
        b.type === "p" ? (
          b.lines.length ? (
            <p key={i} className="mb-2 last:mb-0">
              {b.lines.map((l, j) => (
                <Fragment key={j}>
                  {j > 0 ? <br /> : null}
                  {inline(l)}
                </Fragment>
              ))}
            </p>
          ) : null
        ) : b.type === "ul" ? (
          <ul key={i} className="mb-2 list-disc space-y-1 pl-5 last:mb-0">
            {b.items.map((it, j) => (
              <li key={j}>{inline(it)}</li>
            ))}
          </ul>
        ) : (
          <ol key={i} className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">
            {b.items.map((it, j) => (
              <li key={j}>{inline(it)}</li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}
