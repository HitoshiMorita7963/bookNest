"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Maximize2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { layout } from "@/lib/graph-layout";
import { isLead, relationArcs, type MapRelation } from "@/lib/character-map";

interface MapCharacter {
  id: string;
  name: string;
  role: string | null;
}

/** 線の中央をふくらませる量（逆向きの関係が両方あるとき） */
const BEND = 42;
const short = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** 人物相関図：人物を点、関係を矢印つきの線で描く。知識マップと同じく、ドラッグで移動・拡大縮小できる */
export function CharacterMap({ projectId, characters, relations }: { projectId: string; characters: MapCharacter[]; relations: MapRelation[] }) {
  const [selected, setSelected] = useState<{ kind: "character" | "arc"; id: string } | null>(null);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { arcs, positions, radius } = useMemo(() => {
    const ids = new Set(characters.map((c) => c.id));
    const arcs = relationArcs(relations.filter((r) => ids.has(r.fromId) && ids.has(r.toId)));
    const idx = new Map(characters.map((c, i) => [c.id, i]));
    const radius = characters.map((c) => (isLead(c.role) ? 30 : 24));
    const positions = layout(
      characters.length,
      arcs.map((a) => [idx.get(a.fromId)!, idx.get(a.toId)!, 1] as const),
      // 名前と関係の文字が重ならないよう、点を大きめに見積もって離す
      { sizes: radius.map((r) => r + 34), linkLength: 190, gravity: 0.05 },
    );
    return { arcs, positions: new Map(characters.map((c, i) => [c.id, positions[i]])), radius: new Map(characters.map((c, i) => [c.id, radius[i]])) };
  }, [characters, relations]);

  const bounds = useMemo(() => {
    const ps = [...positions.values()];
    if (!ps.length) return { x: -200, y: -200, w: 400, h: 400 };
    const pad = 100;
    const xs = ps.map((p) => p.x);
    const ys = ps.map((p) => p.y);
    return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
  }, [positions]);

  const byId = new Map(characters.map((c) => [c.id, c]));
  const selChar = selected?.kind === "character" ? byId.get(selected.id) : undefined;
  const selArc = selected?.kind === "arc" ? arcs.find((a) => a.key === selected.id) : undefined;
  const activeArcs = new Set(selChar ? arcs.filter((a) => a.fromId === selChar.id || a.toId === selChar.id).map((a) => a.key) : selArc ? [selArc.key] : []);
  const activeChars = new Set(
    selChar ? [selChar.id, ...arcs.filter((a) => activeArcs.has(a.key)).flatMap((a) => [a.fromId, a.toId])] : selArc ? [selArc.fromId, selArc.toId] : [],
  );
  const dimmed = (on: boolean) => (selected && !on ? 0.2 : 1);

  function zoom(f: number) {
    setView((v) => ({ ...v, scale: Math.max(0.4, Math.min(3, v.scale * f)) }));
  }
  /** 点や線をタップしたとき（ドラッグで動かしたときは選ばない） */
  function tap(e: React.PointerEvent, next: { kind: "character" | "arc"; id: string }) {
    e.stopPropagation();
    if (!drag.current?.moved) setSelected((cur) => (cur?.kind === next.kind && cur.id === next.id ? null : next));
    drag.current = null;
  }

  if (!characters.length) return null;

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-2xl border bg-card">
        <svg
          ref={svgRef}
          viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
          className="h-[56dvh] w-full touch-none select-none md:h-[520px]"
          role="img"
          aria-label={`人物相関図（${characters.length}人・${relations.length}件の関係）`}
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
            <marker id="rel-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--muted-foreground)" />
            </marker>
          </defs>
          <g transform={`translate(${bounds.x + bounds.w / 2} ${bounds.y + bounds.h / 2}) scale(${view.scale}) translate(${-(bounds.x + bounds.w / 2) + view.tx} ${-(bounds.y + bounds.h / 2) + view.ty})`}>
            {arcs.map((arc) => {
              const a = positions.get(arc.fromId)!;
              const b = positions.get(arc.toId)!;
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const d = Math.max(1, Math.hypot(dx, dy));
              // 進む向きの右側へふくらませる制御点
              const c = { x: (a.x + b.x) / 2 - (dy / d) * BEND * arc.bend, y: (a.y + b.y) / 2 + (dx / d) * BEND * arc.bend };
              const toward = (p: { x: number; y: number }, q: { x: number; y: number }, r: number) => {
                const l = Math.max(1, Math.hypot(q.x - p.x, q.y - p.y));
                return { x: p.x + ((q.x - p.x) / l) * r, y: p.y + ((q.y - p.y) / l) * r };
              };
              const s = toward(a, c, radius.get(arc.fromId)! + 3);
              const t = toward(b, c, radius.get(arc.toId)! + 6);
              const mid = { x: 0.25 * s.x + 0.5 * c.x + 0.25 * t.x, y: 0.25 * s.y + 0.5 * c.y + 0.25 * t.y };
              const on = activeArcs.has(arc.key);
              return (
                <g key={arc.key} opacity={dimmed(on)}>
                  <path d={`M${s.x},${s.y} Q${c.x},${c.y} ${t.x},${t.y}`} fill="none" stroke="var(--muted-foreground)" strokeWidth={on ? 2.4 : 1.6} markerEnd="url(#rel-arrow)" />
                  <g className="cursor-pointer" onPointerUp={(e) => tap(e, { kind: "arc", id: arc.key })} role="button" aria-label={`${byId.get(arc.fromId)?.name} → ${byId.get(arc.toId)?.name}：${arc.label}`}>
                    <circle cx={mid.x} cy={mid.y} r={18} fill="transparent" />
                    <text x={mid.x} y={mid.y} dy="0.35em" textAnchor="middle" fontSize={12} fontWeight={on ? 700 : 600} fill="var(--primary)" paintOrder="stroke" stroke="var(--card)" strokeWidth={5}>
                      {short(arc.label, 12)}
                    </text>
                  </g>
                </g>
              );
            })}
            {characters.map((ch) => {
              const p = positions.get(ch.id)!;
              const r = radius.get(ch.id)!;
              const lead = isLead(ch.role);
              const on = selChar?.id === ch.id;
              return (
                <g
                  key={ch.id}
                  transform={`translate(${p.x} ${p.y})`}
                  opacity={dimmed(activeChars.has(ch.id))}
                  className="cursor-pointer"
                  onPointerUp={(e) => tap(e, { kind: "character", id: ch.id })}
                  role="button"
                  aria-label={ch.role ? `${ch.name}（${ch.role}）` : ch.name}
                >
                  <circle r={r + 10} fill="transparent" />
                  <circle r={r} fill={lead ? "var(--primary)" : "var(--card)"} stroke="var(--primary)" strokeWidth={on ? 4 : 2.5} />
                  <text textAnchor="middle" dy="0.36em" fontSize={lead ? 20 : 17} fontWeight={700} fill={lead ? "var(--primary-foreground)" : "var(--primary)"}>
                    {ch.name.slice(0, 1)}
                  </text>
                  <text y={r + 17} textAnchor="middle" fontSize={13} fontWeight={on ? 700 : 600} fill="var(--foreground)" paintOrder="stroke" stroke="var(--card)" strokeWidth={4}>
                    {short(ch.name, 10)}
                  </text>
                  {ch.role ? (
                    <text y={r + 32} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)" paintOrder="stroke" stroke="var(--card)" strokeWidth={4}>
                      {short(ch.role, 10)}
                    </text>
                  ) : null}
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

        {selChar ? (
          <div className="absolute inset-x-2 bottom-2 rounded-xl border bg-popover p-3 shadow-lg" role="region" aria-label={`${selChar.name}の関係`}>
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate font-semibold">
                {selChar.name}
                {selChar.role ? <span className="ml-2 text-xs font-normal text-primary">{selChar.role}</span> : null}
              </p>
              <Button asChild size="sm">
                <Link href={`/creative/projects/${projectId}/characters/${selChar.id}`}>開く</Link>
              </Button>
            </div>
            <ul className="mt-1.5 max-h-28 space-y-0.5 overflow-y-auto text-sm">
              {arcs
                .filter((a) => activeArcs.has(a.key))
                .map((a) => {
                  const out = a.fromId === selChar.id;
                  const other = byId.get(out ? a.toId : a.fromId)?.name;
                  return (
                    <li key={a.key} className="flex items-center gap-1.5">
                      {out ? <ArrowRight className="size-3.5 text-muted-foreground" aria-label="から" /> : <ArrowLeft className="size-3.5 text-muted-foreground" aria-label="へ" />}
                      <span className="font-medium">{other}</span>
                      <span className="text-primary">{a.label}</span>
                    </li>
                  );
                })}
              {activeArcs.size === 0 ? <li className="text-muted-foreground">まだ関係がありません</li> : null}
            </ul>
          </div>
        ) : selArc ? (
          <div className="absolute inset-x-2 bottom-2 rounded-xl border bg-popover p-3 shadow-lg" role="region" aria-label="関係の詳細">
            <p className="flex flex-wrap items-center gap-1.5 font-semibold">
              {byId.get(selArc.fromId)?.name}
              <ArrowRight className="size-4 text-muted-foreground" aria-label="→" />
              {byId.get(selArc.toId)?.name}
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{selArc.label}</span>
            </p>
            {selArc.relations.some((r) => r.notes) ? (
              <ul className="mt-1.5 max-h-28 space-y-1 overflow-y-auto text-sm text-muted-foreground">
                {selArc.relations
                  .filter((r) => r.notes)
                  .map((r) => (
                    <li key={r.id} className="whitespace-pre-wrap">
                      {selArc.relations.length > 1 ? <span className="font-medium text-foreground">{r.label}：</span> : null}
                      {r.notes}
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        矢印は「だれから、だれへ」の関係です。人物や関係の文字をタップすると、つながりが強調されます。ドラッグで移動、ボタンやホイールで拡大・縮小できます。
      </p>
    </div>
  );
}
