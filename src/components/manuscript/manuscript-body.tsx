import { Fragment } from "react";
import { bodyLines, parseInline } from "@/lib/manuscript";

/** 本文1行：ルビは <ruby>、傍点は圏点で表示する */
function Line({ line }: { line: string }) {
  if (!line.trim()) return <p className="ms-blank" aria-hidden />;
  return (
    <p>
      {parseInline(line).map((s, i) =>
        "text" in s ? (
          <Fragment key={i}>{s.text}</Fragment>
        ) : "base" in s ? (
          <ruby key={i}>
            {s.base}
            <rp>（</rp>
            <rt>{s.ruby}</rt>
            <rp>）</rp>
          </ruby>
        ) : (
          <em key={i} className="ms-emph">
            {s.emphasis}
          </em>
        ),
      )}
    </p>
  );
}

export function ManuscriptBody({ content }: { content: string }) {
  return (
    <>
      {bodyLines(content).map((l, i) => (
        <Line key={i} line={l} />
      ))}
    </>
  );
}
