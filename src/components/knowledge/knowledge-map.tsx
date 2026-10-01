"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Minus, Plus, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Node {
  id: string;
  title: string;
  category: string | null;
  weight: number;
}
interface Edge {
  fromId: string;
  toId: string;
  label: string | null;
  implicit: boolean;
}

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

/** シンプルな力学モデルでノードを配置（決定的：同じデータなら同じ配置） */
function layout(nodes: Node[], edges: Edge[]) {
  const n = nodes.length;
  const idx = new Map(nodes.map((nd, i) => [nd.id, i]));
  const pos = nodes.map((_, i) => {
    const a = (2 * Math.PI * i) / Math.max(1, n);
    const r = 120 + 12 * Math.sqrt(n);
    return { x: Math.cos(a) * r, y: Math.sin(a) * r, vx: 0, vy: 0 };
  });
  const E = edges.map((e) => [idx.get(e.fromId)!, idx.get(e.toId)!, e.implicit ? 0.4 : 1] as const).filter(([a, b]) => a != null && b != null);
  const iterations = Math.min(400, 120 + n * 4);
  for (let it = 0; it < iterations; it++) {
    const cool = 1 - it / iterations;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const d2 = Math.max(100, dx * dx + dy * dy);
        const f = 9000 / d2;
        const d = Math.sqrt(d2);
        pos[i].vx += (dx / d) * f;
        pos[i].vy += (dy / d) * f;
        pos[j].vx -= (dx / d) * f;
        pos[j].vy -= (dy / d) * f;
      }
    }
    for (const [a, b, w] of E) {
      const dx = pos[b].x - pos[a].x;
      const dy = pos[b].y - pos[a].y;
      const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const f = (d - 130) * 0.04 * w;
      pos[a].vx += (dx / d) * f;
      pos[a].vy += (dy / d) * f;
      pos[b].vx -= (dx / d) * f;
      pos[b].vy -= (dy / d) * f;
    }
    for (const p of pos) {
      p.vx -= p.x * 0.01;
      p.vy -= p.y * 0.01;
      const max = 20 * cool + 1;
      p.x += Math.max(-max, Math.min(max, p.vx * 0.5));
      p.y += Math.max(-max, Math.min(max, p.vy * 0.5));
      p.vx *= 0.5;
      p.vy *= 0.5;
    }
  }
  return pos.map((p) => ({ x: p.x, y: p.y }));
}

export function KnowledgeMap({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const positions = useMemo(() => layout(nodes, edges), [nodes, edges]);
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of nodes) if (n.category) counts.set(n.category, (counts.get(n.category) ?? 0) + 1);
    // 件数の多い順に固定の色を割り当て、6種類目以降は「その他」にまとめる
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, COLORS.length).map(([name]) => name);
  }, [nodes]);
  const colorOf = (c: string | null) => {
    const i = c ? categories.indexOf(c) : -1;
    return i >= 0 ? COLORS[i] : "var(--muted-foreground)";
  };
  const bounds = useMemo(() => {
    if (!positions.length) return { x: -200, y: -200, w: 400, h: 400 };
    const xs = positions.map((p) => p.x);
    const ys = positions.map((p) => p.y);
    const pad = 90;
    return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
  }, [positions]);

  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const sel = selected ? nodes[idx.get(selected)!] : null;
  const neighbors = new Set(selected ? edges.filter((e) => e.fromId === selected || e.toId === selected).flatMap((e) => [e.fromId, e.toId]) : []);

  function zoom(f: number) {
    setView((v) => ({ ...v, scale: Math.max(0.4, Math.min(3, v.scale * f)) }));
  }

  if (!nodes.length) return null;
  const vb = `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`;

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border bg-card">
        <svg
          ref={svgRef}
          viewBox={vb}
          className="h-[62dvh] w-full touch-none select-none md:h-[560px]"
          role="img"
          aria-label="知識マップ"
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture?.(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const unit = bounds.w / (svgRef.current?.clientWidth || 600);
            const dx = e.clientX - d.x;
            const dy = e.clientY - d.y;
            if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
            setView((v) => ({ ...v, tx: d.tx + (dx * unit) / v.scale, ty: d.ty + (dy * unit) / v.scale }));
          }}
          onPointerUp={() => {
            if (drag.current && !drag.current.moved) setSelected(null);
            drag.current = null;
          }}
          onWheel={(e) => zoom(e.deltaY < 0 ? 1.1 : 0.9)}
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--muted-foreground)" />
            </marker>
          </defs>
          <g transform={`translate(${bounds.x + bounds.w / 2} ${bounds.y + bounds.h / 2}) scale(${view.scale}) translate(${-(bounds.x + bounds.w / 2) + view.tx} ${-(bounds.y + bounds.h / 2) + view.ty})`}>
            {edges.map((e, i) => {
              const a = positions[idx.get(e.fromId)!];
              const b = positions[idx.get(e.toId)!];
              if (!a || !b) return null;
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const d = Math.max(1, Math.hypot(dx, dy));
              const r = 16;
              const active = selected && (e.fromId === selected || e.toId === selected);
              return (
                <g key={i} opacity={selected && !active ? 0.15 : 1}>
                  <line
                    x1={a.x + (dx / d) * r}
                    y1={a.y + (dy / d) * r}
                    x2={b.x - (dx / d) * (r + 3)}
                    y2={b.y - (dy / d) * (r + 3)}
                    stroke="var(--muted-foreground)"
                    strokeWidth={active ? 2.4 : 1.4}
                    strokeDasharray={e.implicit ? "4 4" : undefined}
                    markerEnd={e.implicit ? undefined : "url(#arrow)"}
                  />
                  {e.label && !e.implicit ? (
                    <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">
                      {e.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
            {nodes.map((n, i) => {
              const p = positions[i];
              const dim = selected && selected !== n.id && !neighbors.has(n.id);
              const r = 12 + Math.min(10, n.weight * 1.5);
              return (
                <g
                  key={n.id}
                  transform={`translate(${p.x} ${p.y})`}
                  opacity={dim ? 0.25 : 1}
                  className="cursor-pointer"
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    if (!drag.current?.moved) setSelected(n.id === selected ? null : n.id);
                    drag.current = null;
                  }}
                  role="button"
                  aria-label={n.title}
                >
                  <circle r={r + 10} fill="transparent" />
                  <circle r={r} fill={colorOf(n.category)} stroke="var(--card)" strokeWidth={2} />
                  <text y={r + 15} textAnchor="middle" fontSize="13" fontWeight={selected === n.id ? 700 : 500} fill="var(--foreground)" paintOrder="stroke" stroke="var(--card)" strokeWidth={4}>
                    {n.title.length > 14 ? n.title.slice(0, 13) + "…" : n.title}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <Button variant="outline" size="icon-sm" aria-label="拡大" onClick={() => zoom(1.25)}>
            <Plus />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="縮小" onClick={() => zoom(0.8)}>
            <Minus />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="全体表示" onClick={() => setView({ scale: 1, tx: 0, ty: 0 })}>
            <Maximize2 />
          </Button>
        </div>
        {sel ? (
          <div className="absolute inset-x-2 bottom-2 flex items-center gap-3 rounded-xl border bg-popover p-3 shadow-lg">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{sel.title}</p>
              <p className="text-xs text-muted-foreground">
                {sel.category ?? "カテゴリなし"} ・ つながり {neighbors.size ? neighbors.size - 1 : 0}件
              </p>
            </div>
            <Button asChild size="sm">
              <Link href={`/knowledge/${sel.id}`}>開く</Link>
            </Button>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {categories.map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: colorOf(c) }} />
            {c}
          </span>
        ))}
        {nodes.some((n) => !n.category || !categories.includes(n.category)) ? (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-muted-foreground" />
            その他
          </span>
        ) : null}
        <span className="flex items-center gap-1.5">
          <svg width="22" height="6" aria-hidden>
            <line x1="0" y1="3" x2="22" y2="3" stroke="currentColor" strokeDasharray="4 3" />
          </svg>
          同じ本から得た知識
        </span>
      </div>
    </div>
  );
}
