/** 点と線の図（知識マップ・相関図）の配置計算 */

export type Pos = { x: number; y: number };

/**
 * シンプルな力学モデルで配置する（決定的：同じデータなら同じ配置）。
 * anchors を渡すと、各点をその位置へ引き寄せる（カテゴリごとにまとめる）。
 * gravity は中心へ引き寄せる強さ（つながりのない点が遠くへ離れすぎないように）。
 */
export function layout(count: number, edges: (readonly [number, number, number])[], opts: { sizes?: number[]; linkLength?: number; anchors?: Pos[]; gravity?: number } = {}): Pos[] {
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
      const g = opts.anchors ? 0.05 : (opts.gravity ?? 0.01);
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
