/** 相関図：人物の関係を、図に描く線にまとめる */

export interface MapRelation {
  id: string;
  fromId: string;
  toId: string;
  label: string;
  notes: string | null;
}

export interface MapArc {
  key: string;
  fromId: string;
  toId: string;
  /** 同じ向きの関係をまとめたもの（例：「幼馴染・恋愛」） */
  label: string;
  relations: MapRelation[];
  /** 線の曲げ方。0 はまっすぐ、1 は逆向きの関係と重ならないよう進む向きの右側へふくらませる */
  bend: 0 | 1;
}

/**
 * 同じ2人・同じ向きの関係は1本の線にまとめる。
 * 逆向きの関係もある2人（A→B 片思い、B→A 無関心 など）は、2本の線を左右にふくらませて描く。
 */
export function relationArcs(relations: MapRelation[]): MapArc[] {
  const byDir = new Map<string, MapRelation[]>();
  for (const r of relations) {
    if (r.fromId === r.toId) continue;
    const key = `${r.fromId}>${r.toId}`;
    byDir.set(key, [...(byDir.get(key) ?? []), r]);
  }
  return [...byDir.entries()].map(([key, rels]) => {
    const { fromId, toId } = rels[0];
    const labels = [...new Set(rels.map((r) => r.label.trim()).filter(Boolean))];
    // 進む向きの右側へふくらませると、逆向きの線は自然に反対側を通る
    const bend = byDir.has(`${toId}>${fromId}`) ? 1 : 0;
    return { key, fromId, toId, label: labels.join("・"), relations: rels, bend };
  });
}

/** 主人公らしい人物（役割に「主人公」とある）は大きく描く */
export const isLead = (role: string | null | undefined) => !!role && /主人公|主役/.test(role);
