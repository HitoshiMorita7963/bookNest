import { describe, expect, it } from "vitest";
import { deriveSeries, isPublisherLabel, parseVolume, splitVolumeFromTitle } from "@/lib/series";

describe("parseVolume", () => {
  it("understands common Japanese volume notations", () => {
    expect(parseVolume("上")).toBe(1);
    expect(parseVolume("上巻")).toBe(1);
    expect(parseVolume("下")).toBe(2);
    expect(parseVolume("巻一")).toBe(1);
    expect(parseVolume("第12巻")).toBe(12);
    expect(parseVolume("３")).toBe(3);
    expect(parseVolume("二十一")).toBe(21);
    expect(parseVolume("Vol.5")).toBe(5);
    expect(parseVolume("後編")).toBe(2);
    // 文庫の整理番号や版表記は巻ではない
    expect(parseVolume("な31-3")).toBeNull();
    expect(parseVolume("改版")).toBeNull();
    expect(parseVolume("")).toBeNull();
  });
});

describe("splitVolumeFromTitle", () => {
  it("splits trailing volume marks", () => {
    expect(splitVolumeFromTitle("ノルウェイの森. 上")).toMatchObject({ base: "ノルウェイの森", volume: 1 });
    expect(splitVolumeFromTitle("罪と罰（下）")).toMatchObject({ base: "罪と罰", volume: 2 });
    expect(splitVolumeFromTitle("One piece 巻1")).toMatchObject({ base: "One piece", volume: 1 });
    expect(splitVolumeFromTitle("進撃の巨人 34")).toMatchObject({ base: "進撃の巨人", volume: 34 });
    expect(splitVolumeFromTitle("鬼滅の刃 第5巻")).toMatchObject({ base: "鬼滅の刃", volume: 5 });
  });
  it("does not split ordinary titles", () => {
    expect(splitVolumeFromTitle("吾輩は猫である")).toBeNull();
    expect(splitVolumeFromTitle("AI 2041")).toBeNull();
    expect(splitVolumeFromTitle("1Q84")).toBeNull();
  });
});

describe("deriveSeries", () => {
  it("uses title + volume and ignores publisher labels", () => {
    expect(isPublisherLabel("講談社文庫")).toBe(true);
    expect(isPublisherLabel("ジャンプ・コミックス")).toBe(true);
    expect(deriveSeries({ title: "ノルウェイの森", seriesTitle: "講談社文庫", volume: "上" })).toEqual({ seriesTitle: "ノルウェイの森", seriesNumber: 1 });
    expect(deriveSeries({ title: "One piece 巻1", seriesTitle: "ジャンプ・コミックス" })).toEqual({ seriesTitle: "One piece", seriesNumber: 1 });
    expect(deriveSeries({ title: "吾輩は猫である", seriesTitle: "文春文庫 ; な31-3" })).toEqual({ seriesTitle: null, seriesNumber: null });
  });
  it("keeps a real series name", () => {
    expect(deriveSeries({ title: "銀河英雄伝説 3", seriesTitle: "銀河英雄伝説" })).toEqual({ seriesTitle: "銀河英雄伝説", seriesNumber: 3 });
  });
});

describe("deriveSeries with numbered series names", () => {
  it("splits the volume out of the series name", () => {
    expect(deriveSeries({ title: "ハリー・ポッターと賢者の石", seriesTitle: "ハリー・ポッターシリーズ　1" })).toEqual({ seriesTitle: "ハリー・ポッター", seriesNumber: 1 });
  });
});
