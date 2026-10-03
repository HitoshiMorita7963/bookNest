"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Maximize2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

const UNCATEGORIZED = "未分類";
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
/** この件数以下なら、最初から全部の知識を1枚に表示する */
const SHOW_ALL_LIMIT = 40;
const ALL = "__all";

type Pos = { x: number; y: number };
const catOf = (n: Node) => n.category ?? UNCATEGORIZED;

/**
 * シンプルな力学モデルで配置する（決定的：同じデータなら同じ配置）。
 * anchors を渡すと、各点をその位置へ引き寄せる（カテゴリごとにまとめる）。
 */
function layout(count: number, edges: (readonly [number, number, number])[], opts: { sizes?: number[]; linkLength?: number; anchors?: Pos[] } = {}): Pos[] {
  const linkLength = opts.linkLength ?? 130;
  const pos = Array.from({ length: count }, (_, i) => {
    const a = (2 * Math.PI * i) / Math.max(1, count);
    const r = opts.anchors ? 40 : 120 + 12 * Math.sqrt(count);
    const c = opts.anchors?.[i] ?? { x: 0, y: 0 };
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, vx: 0, vy: 0 };
  });
  const iterations = Math.min(400, 120 + count * 4);
  for (let it = 0; it < iterations; it++) {
    const cool = 1 - it / iterations;
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const d2 = Math.max(100, dx * dx + dy * dy);
        const size = ((opts.sizes?.[i] ?? 16) + (opts.sizes?.[j] ?? 16)) / 32;
        const f = (9000 * size * size) / d2;
        const d = Math.sqrt(d2);
        pos[i].vx += (dx / d) * f;
        pos[i].vy += (dy / d) * f;
        pos[j].vx -= (dx / d) * f;
        pos[j].vy -= (dy / d) * f;
      }
    }
    for (const [a, b, w] of edges) {
      const dx = pos[b].x - pos[a].x;
      const dy = pos[b].y - pos[a].y;
      const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const f = (d - linkLength) * 0.04 * w;
      pos[a].vx += (dx / d) * f;
      pos[a].vy += (dy / d) * f;
      pos[b].vx -= (dx / d) * f;
      pos[b].vy -= (dy / d) * f;
    }
    pos.forEach((p, i) => {
      const c = opts.anchors?.[i] ?? { x: 0, y: 0 };
      const g = opts.anchors ? 0.05 : 0.01;
      p.vx -= (p.x - c.x) * g;
      p.vy -= (p.y - c.y) * g;
      const max = 20 * cool + 1;
      p.x += Math.max(-max, Math.min(max, p.vx * 0.5));
      p.y += Math.max(-max, Math.min(max, p.vy * 0.5));
      p.vx *= 0.5;
      p.vy *= 0.5;
    });
  }
  return pos.map((p) => ({ x: p.x, y: p.y }));
}

interface ViewNode {
  id: string;
  label: string;
  /** category: カテゴリの円（全体表示）／ note: 知識／ outside: 表示中のカテゴリ外の知識 */
  kind: "category" | "note" | "outside";
  category: string;
  r: number;
  count?: number;
  color: string;
}
interface ViewEdge {
  a: number;
  b: number;
  label: string | null;
  implicit: boolean;
  /** 全体表示でのカテゴリ間のつながりの本数 */
  weight?: number;
  directed: boolean;
}

export function KnowledgeMap({ nodes, edges, initialCategory }: { nodes: Node[]; edges: Edge[]; initialCategory?: string | null }) {
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of nodes) counts.set(catOf(n), (counts.get(catOf(n)) ?? 0) + 1);
    return [...counts.entries()]
      .sort(([a, x], [b, y]) => (a === UNCATEGORIZED ? 1 : b === UNCATEGORIZED ? -1 : y - x || a.localeCompare(b, "ja")))
      .map(([name, count]) => ({ name, count }));
  }, [nodes]);
  const small = nodes.length <= SHOW_ALL_LIMIT;
  const [focus, setFocus] = useState<string | null>(initialCategory && categories.some((c) => c.name === initialCategory) ? initialCategory : small ? ALL : null);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });

  // 全体表示（すべて）のときの色：件数の多い5カテゴリに色を割り当て、残りはグレー
  const topColors = useMemo(() => new Map(categories.filter((c) => c.name !== UNCATEGORIZED).slice(0, COLORS.length).map((c, i) => [c.name, COLORS[i]])), [categories]);
  const colorOf = (c: string) => topColors.get(c) ?? "var(--muted-foreground)";

  const graph = useMemo(() => {
    const explicit = edges.filter((e) => !e.implicit);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    let vNodes: ViewNode[] = [];
    let vEdges: ViewEdge[] = [];
    let positions: Pos[] = [];

    if (focus === null) {
      // カテゴリの全体図：円の大きさ＝知識の数、線の太さ＝カテゴリ間のつながりの数
      vNodes = categories.map((c) => ({ id: `cat:${c.name}`, label: c.name, kind: "category", category: c.name, r: 16 + Math.sqrt(c.count) * 5, count: c.count, color: "var(--primary)" }));
      const idx = new Map(categories.map((c, i) => [c.name, i]));
      const agg = new Map<string, number>();
      for (const e of explicit) {
        const a = byId.get(e.fromId);
        const b = byId.get(e.toId);
        if (!a || !b || catOf(a) === catOf(b)) continue;
        const key = [catOf(a), catOf(b)].sort().join("\u0001");
        agg.set(key, (agg.get(key) ?? 0) + 1);
      }
      vEdges = [...agg.entries()].map(([key, w]) => {
        const [a, b] = key.split("\u0001");
        return { a: idx.get(a)!, b: idx.get(b)!, label: String(w), implicit: false, weight: w, directed: false };
      });
      positions = layout(vNodes.length, vEdges.map((e) => [e.a, e.b, Math.min(1, 0.3 + 0.1 * (e.weight ?? 1))] as const), { sizes: vNodes.map((n) => n.r), linkLength: 200 });
    } else {
      const inFocus = (n: Node) => focus === ALL || catOf(n) === focus;
      const inner = nodes.filter(inFocus);
      const innerIds = new Set(inner.map((n) => n.id));
      // 表示中のカテゴリの知識とつながっている、他のカテゴリの知識
      const outsideIds = new Set<string>();
      if (focus !== ALL) {
        for (const e of explicit) {
          if (innerIds.has(e.fromId) && !innerIds.has(e.toId)) outsideIds.add(e.toId);
          if (innerIds.has(e.toId) && !innerIds.has(e.fromId)) outsideIds.add(e.fromId);
        }
      }
      const list = [...inner, ...nodes.filter((n) => outsideIds.has(n.id))];
      vNodes = list.map((n) => {
        const outside = outsideIds.has(n.id);
        return {
          id: n.id,
          label: n.title,
          kind: outside ? "outside" : "note",
          category: catOf(n),
          r: outside ? 8 : 11 + Math.min(9, n.weight * 1.5),
          color: outside ? "var(--muted-foreground)" : focus === ALL ? colorOf(catOf(n)) : "var(--primary)",
        };
      });
      const idx = new Map(list.map((n, i) => [n.id, i]));
      vEdges = edges
        .filter((e) => idx.has(e.fromId) && idx.has(e.toId) && (!e.implicit || (innerIds.has(e.fromId) && innerIds.has(e.toId))))
        .map((e) => ({ a: idx.get(e.fromId)!, b: idx.get(e.toId)!, label: e.label, implicit: e.implicit, directed: !e.implicit }));
      // 「すべて」のときはカテゴリごとの位置に引き寄せてまとまりを見せる
      let anchors: Pos[] | undefined;
      if (focus === ALL && categories.length > 1) {
        const R = 150 + 45 * categories.length;
        const at = new Map(categories.map((c, i) => [c.name, { x: Math.cos((2 * Math.PI * i) / categories.length - Math.PI / 2) * R, y: Math.sin((2 * Math.PI * i) / categories.length - Math.PI / 2) * R }]));
        anchors = list.map((n) => at.get(catOf(n))!);
      }
      positions = layout(vNodes.length, vEdges.map((e) => [e.a, e.b, e.implicit ? 0.4 : 1] as const), { anchors, sizes: vNodes.map((n) => n.r + 4) });
    }
    return { vNodes, vEdges, positions };
    // colorOf は topColors から決まる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, nodes, edges, categories, topColors]);

  const { vNodes, vEdges, positions } = graph;
  const bounds = useMemo(() => {
    if (!positions.length) return { x: -200, y: -200, w: 400, h: 400 };
    const pad = 90;
    const xs = positions.map((p) => p.x);
    const ys = positions.map((p) => p.y);
    return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
  }, [positions]);

  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const selIndex = selected ? vNodes.findIndex((n) => n.id === selected) : -1;
  const sel = selIndex >= 0 ? vNodes[selIndex] : null;
  const neighbors = new Set(selIndex >= 0 ? vEdges.filter((e) => e.a === selIndex || e.b === selIndex).flatMap((e) => [e.a, e.b]) : []);

  function go(next: string | null) {
    setFocus(next);
    setSelected(null);
    setView({ scale: 1, tx: 0, ty: 0 });
  }
  function zoom(f: number) {
    setView((v) => ({ ...v, scale: Math.max(0.4, Math.min(3, v.scale * f)) }));
  }

  if (!nodes.length) return null;
  const focusCount = focus && focus !== ALL ? (categories.find((c) => c.name === focus)?.count ?? 0) : nodes.length;

  return (
    <div className="space-y-3">
      <nav className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" aria-label="表示するカテゴリ">
        {!small ? (
          <MapChip active={focus === null} onClick={() => go(null)}>
            全体
          </MapChip>
        ) : (
          <MapChip active={focus === ALL} onClick={() => go(ALL)}>
            すべて
          </MapChip>
        )}
        {categories.map((c) => (
          <MapChip key={c.name} active={focus === c.name} onClick={() => go(c.name)}>
            {c.name}
            <span className="text-xs opacity-70">{c.count}</span>
          </MapChip>
        ))}
      </nav>

      {focus !== null && focus !== ALL ? (
        <div className="flex items-center gap-2 text-sm">
          {!small ? (
            <Button variant="ghost" size="sm" className="-ml-2" onClick={() => go(null)}>
              <ArrowLeft /> 全体へ
            </Button>
          ) : null}
          <span className="font-semibold">{focus}</span>
          <span className="text-muted-foreground">{focusCount}件</span>
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-2xl border bg-card">
        <svg
          ref={svgRef}
          viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
          className="h-[62dvh] w-full touch-none select-none md:h-[560px]"
          role="img"
          aria-label={focus === null ? "知識マップ（カテゴリの全体図）" : `知識マップ（${focus === ALL ? "すべて" : focus}）`}
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
            {vEdges.map((e, i) => {
              const a = positions[e.a];
              const b = positions[e.b];
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const d = Math.max(1, Math.hypot(dx, dy));
              const ra = vNodes[e.a].r + 2;
              const rb = vNodes[e.b].r + (e.directed ? 5 : 2);
              const active = selIndex >= 0 && (e.a === selIndex || e.b === selIndex);
              const width = e.weight ? Math.min(8, 1.2 + Math.log2(e.weight + 1) * 1.6) : active ? 2.4 : 1.4;
              return (
                <g key={i} opacity={selIndex >= 0 && !active ? 0.12 : e.weight ? (e.weight > 1 ? 0.6 : 0.3) : 0.8}>
                  <line
                    x1={a.x + (dx / d) * ra}
                    y1={a.y + (dy / d) * ra}
                    x2={b.x - (dx / d) * rb}
                    y2={b.y - (dy / d) * rb}
                    stroke="var(--muted-foreground)"
                    strokeWidth={width}
                    strokeDasharray={e.implicit ? "4 4" : undefined}
                    markerEnd={e.directed ? "url(#arrow)" : undefined}
                  />
                  {/* つながりの説明は、知識を選んだときだけ出す（重なって読めなくなるため） */}
                  {e.label && !e.implicit && ((e.weight && e.weight > 1) || active) ? (
                    <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} textAnchor="middle" fontSize={e.weight ? 12 : 10} fill="var(--muted-foreground)" paintOrder="stroke" stroke="var(--card)" strokeWidth={3}>
                      {e.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
            {vNodes.map((n, i) => {
              const p = positions[i];
              const dim = selIndex >= 0 && selIndex !== i && !neighbors.has(i);
              return (
                <g
                  key={n.id}
                  transform={`translate(${p.x} ${p.y})`}
                  opacity={dim ? 0.25 : 1}
                  className="cursor-pointer"
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    if (!drag.current?.moved) {
                      if (n.kind === "category") go(n.category);
                      else setSelected(n.id === selected ? null : n.id);
                    }
                    drag.current = null;
                  }}
                  role="button"
                  aria-label={n.kind === "category" ? `${n.label}（${n.count}件）を表示` : n.label}
                >
                  <circle r={n.r + 10} fill="transparent" />
                  <circle
                    r={n.r}
                    fill={n.color}
                    fillOpacity={n.kind === "category" ? 0.18 : n.kind === "outside" ? 0.45 : 1}
                    stroke={n.kind === "category" ? "var(--primary)" : "var(--card)"}
                    strokeWidth={2}
                  />
                  {n.kind === "category" ? (
                    <>
                      <text textAnchor="middle" dy="0.35em" fontSize="14" fontWeight={700} fill="var(--primary)">
                        {n.count}
                      </text>
                      <text y={n.r + 16} textAnchor="middle" fontSize="13" fontWeight={600} fill="var(--foreground)" paintOrder="stroke" stroke="var(--card)" strokeWidth={4}>
                        {n.label}
                      </text>
                    </>
                  ) : (
                    <text
                      y={n.r + 14}
                      textAnchor="middle"
                      fontSize={n.kind === "outside" ? 10 : 12}
                      fontWeight={selected === n.id ? 700 : 500}
                      fill={n.kind === "outside" ? "var(--muted-foreground)" : "var(--foreground)"}
                      paintOrder="stroke"
                      stroke="var(--card)"
                      strokeWidth={4}
                    >
                      {n.label.length > 12 ? n.label.slice(0, 11) + "…" : n.label}
                    </text>
                  )}
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
        {sel && sel.kind !== "category" ? (
          <div className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-xl border bg-popover p-3 shadow-lg">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{sel.label}</p>
              <p className="text-xs text-muted-foreground">
                {sel.category} ・ つながり {neighbors.size ? neighbors.size - 1 : 0}件
              </p>
            </div>
            {sel.kind === "outside" ? (
              <Button size="sm" variant="outline" onClick={() => go(sel.category)}>
                {sel.category.length > 8 ? "カテゴリへ" : `${sel.category}へ`}
              </Button>
            ) : null}
            <Button asChild size="sm">
              <Link href={`/knowledge/${sel.id}`}>開く</Link>
            </Button>
          </div>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        {focus === null
          ? "円の大きさは知識の数、線の太さと数字はカテゴリをまたぐつながりの数です。カテゴリをタップすると中の知識を表示します。"
          : focus === ALL
            ? "色はカテゴリ（件数の多い5つ）。点線は同じ本から得た知識です。知識をタップすると、つながりが強調されます。"
            : "グレーの小さな点は、このカテゴリの知識とつながっている他のカテゴリの知識です。点線は同じ本から得た知識です。"}
        ドラッグで移動、ボタンやホイールで拡大・縮小できます。
      </p>
    </div>
  );
}

function MapChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-sm whitespace-nowrap",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
