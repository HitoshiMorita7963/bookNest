import { describe, expect, it } from "vitest";
import { isLead, relationArcs } from "@/lib/character-map";
import { layout } from "@/lib/graph-layout";

const rel = (id: string, fromId: string, toId: string, label: string, notes: string | null = null) => ({ id, fromId, toId, label, notes });

describe("character map", () => {
  it("bundles relations of the same direction into one line", () => {
    const arcs = relationArcs([rel("1", "a", "b", "幼馴染"), rel("2", "a", "b", "恋愛"), rel("3", "a", "b", "恋愛"), rel("4", "b", "c", "師弟")]);
    expect(arcs.map((a) => [a.fromId, a.toId, a.label, a.relations.length, a.bend])).toEqual([
      ["a", "b", "幼馴染・恋愛", 3, 0],
      ["b", "c", "師弟", 1, 0],
    ]);
  });

  it("bends both lines when two people have relations in both directions", () => {
    const arcs = relationArcs([rel("1", "a", "b", "片思い"), rel("2", "b", "a", "無関心"), rel("3", "a", "a", "自分")]);
    expect(arcs.map((a) => [a.fromId, a.toId, a.bend])).toEqual([
      ["a", "b", 1],
      ["b", "a", 1],
    ]);
  });

  it("finds the lead from the role", () => {
    expect([isLead("主人公"), isLead("もう一人の主人公"), isLead("主役"), isLead("ヒロイン"), isLead(null)]).toEqual([true, true, true, false, false]);
  });

  it("lays out the same characters the same way every time, and keeps them apart", () => {
    const edges = [[0, 1, 1] as const, [1, 2, 1] as const];
    const a = layout(4, edges, { sizes: [58, 58, 58, 58], linkLength: 190 });
    expect(layout(4, edges, { sizes: [58, 58, 58, 58], linkLength: 190 })).toEqual(a);
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) expect(Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y)).toBeGreaterThan(60);
  });
});
