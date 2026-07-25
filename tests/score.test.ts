import { describe, expect, it } from "vitest";

import {
  beatsPerMeasure,
  durationBeats,
  eventAbsoluteBeat,
  makeDefaultScore,
  makeTrack,
  measureUsedBeats,
  newId,
  normalizeMeasureCount,
  totalMeasures,
  type Measure,
  type Score,
  type ScoreEvent,
} from "@/modules/composer/model/score";

describe("durationBeats", () => {
  it("figuras base", () => {
    expect(durationBeats({ name: "w", dotted: false })).toBe(4);
    expect(durationBeats({ name: "h", dotted: false })).toBe(2);
    expect(durationBeats({ name: "q", dotted: false })).toBe(1);
    expect(durationBeats({ name: "8", dotted: false })).toBe(0.5);
    expect(durationBeats({ name: "16", dotted: false })).toBe(0.25);
  });

  it("puntillo suma la mitad", () => {
    expect(durationBeats({ name: "h", dotted: true })).toBe(3);
    expect(durationBeats({ name: "q", dotted: true })).toBe(1.5);
    expect(durationBeats({ name: "8", dotted: true })).toBe(0.75);
  });
});

describe("beatsPerMeasure", () => {
  const withSig = (num: number, den: number): Score => ({
    ...makeDefaultScore(),
    timeSig: [num, den],
  });

  it("métricas comunes", () => {
    expect(beatsPerMeasure(withSig(4, 4))).toBe(4);
    expect(beatsPerMeasure(withSig(3, 4))).toBe(3);
    expect(beatsPerMeasure(withSig(2, 4))).toBe(2);
    expect(beatsPerMeasure(withSig(6, 8))).toBe(3);
    expect(beatsPerMeasure(withSig(12, 8))).toBe(6);
  });
});

describe("makeTrack", () => {
  it("guitarra tiene 6 cuerdas y sonido por defecto", () => {
    const t = makeTrack("guitar", 4);
    expect(t.tuning).toHaveLength(6);
    expect(t.tuning![5]).toBe(40); // E2 grave
    expect(t.sound).toBe("acoustic");
    expect(t.measures).toHaveLength(4);
  });

  it("bajo tiene 4 cuerdas", () => {
    expect(makeTrack("bass", 2).tuning).toHaveLength(4);
  });

  it("piano/voz/batería no tienen afinación", () => {
    expect(makeTrack("piano", 1).tuning).toBeUndefined();
    expect(makeTrack("voice", 1).tuning).toBeUndefined();
    expect(makeTrack("drums", 1).tuning).toBeUndefined();
  });

  it("valores de mezcla por defecto", () => {
    const t = makeTrack("piano", 1);
    expect(t.volume).toBe(0.8);
    expect(t.pan).toBe(0);
    expect(t.mute).toBe(false);
    expect(t.solo).toBe(false);
    expect(t.transpose).toBe(0);
    expect(t.visible).toBe(true);
  });
});

describe("makeDefaultScore", () => {
  it("estructura por defecto", () => {
    const s = makeDefaultScore();
    expect(s.bpm).toBe(100);
    expect(s.timeSig).toEqual([4, 4]);
    expect(s.key).toBe("C major");
    expect(s.tracks).toHaveLength(1);
    expect(s.tracks[0].instrument).toBe("guitar");
  });

  it("acepta título", () => {
    expect(makeDefaultScore("Mi canción").title).toBe("Mi canción");
  });
});

describe("newId", () => {
  it("genera ids únicos", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(ids.size).toBe(1000);
  });

  it("respeta el prefijo", () => {
    expect(newId("t").startsWith("t")).toBe(true);
  });
});

describe("compases", () => {
  const ev = (start: number, beats: "q" | "h"): ScoreEvent => ({
    id: newId(),
    start,
    duration: { name: beats, dotted: false },
    isRest: false,
    pitches: [{ midi: 60 }],
  });

  it("measureUsedBeats devuelve el último beat ocupado", () => {
    const m: Measure = { events: [ev(0, "q"), ev(1, "h")] };
    expect(measureUsedBeats(m)).toBe(3);
    expect(measureUsedBeats({ events: [] })).toBe(0);
  });

  it("eventAbsoluteBeat suma compases anteriores", () => {
    const s = makeDefaultScore();
    expect(eventAbsoluteBeat(s, 2, ev(1.5, "q"))).toBe(9.5); // 2*4 + 1.5
  });

  it("totalMeasures toma el máximo entre pistas", () => {
    const s = makeDefaultScore();
    s.tracks.push(makeTrack("bass", 8));
    expect(totalMeasures(s)).toBe(8);
  });

  it("normalizeMeasureCount iguala todas las pistas", () => {
    const s = makeDefaultScore(); // guitarra con 4
    s.tracks.push(makeTrack("bass", 8));
    normalizeMeasureCount(s);
    expect(s.tracks[0].measures).toHaveLength(8);
    expect(s.tracks[1].measures).toHaveLength(8);
  });
});
