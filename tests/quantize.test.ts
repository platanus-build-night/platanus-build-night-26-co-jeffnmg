import { describe, expect, it } from "vitest";

import {
  beatsToDuration,
  countTrackNotes,
  rawNotesToTrack,
} from "@/modules/composer/model/quantize";
import { durationBeats, makeDefaultScore } from "@/modules/composer/model/score";

describe("beatsToDuration", () => {
  it("elige la figura más cercana", () => {
    expect(beatsToDuration(1)).toEqual({ name: "q", dotted: false });
    expect(beatsToDuration(0.5)).toEqual({ name: "8", dotted: false });
    expect(beatsToDuration(3)).toEqual({ name: "h", dotted: true });
    expect(beatsToDuration(4)).toEqual({ name: "w", dotted: false });
    // valores intermedios se acercan a la figura más próxima
    expect(durationBeats(beatsToDuration(0.9))).toBe(1);
  });
});

describe("rawNotesToTrack", () => {
  const score = makeDefaultScore();

  it("cuantiza notas a la rejilla y compases correctos", () => {
    // A 120 BPM, un beat = 0.5s. Notas en beat 0 y beat 1.
    const track = rawNotesToTrack(
      [
        { midi: 60, startSec: 0, durationSec: 0.5 },
        { midi: 62, startSec: 0.5, durationSec: 0.5 },
      ],
      120,
      score,
      "piano",
      "Transcripción"
    );

    expect(track.name).toBe("Transcripción");
    expect(track.measures.length).toBeGreaterThanOrEqual(1);
    const events = track.measures[0].events;
    expect(events).toHaveLength(2);
    expect(events[0].start).toBe(0);
    expect(events[0].pitches[0].midi).toBe(60);
    expect(events[1].start).toBe(1);
    expect(events[1].pitches[0].midi).toBe(62);
  });

  it("agrupa notas simultáneas como acorde sin duplicar pitches", () => {
    const track = rawNotesToTrack(
      [
        { midi: 60, startSec: 0, durationSec: 1 },
        { midi: 64, startSec: 0.01, durationSec: 1 },
        { midi: 64, startSec: 0.02, durationSec: 1 },
      ],
      120,
      score,
      "piano",
      "Acorde"
    );

    const [event] = track.measures[0].events;
    expect(event.pitches.map((p) => p.midi).sort()).toEqual([60, 64]);
  });

  it("recorta la duración para no pisar la siguiente nota", () => {
    const track = rawNotesToTrack(
      [
        { midi: 60, startSec: 0, durationSec: 10 }, // larguísima
        { midi: 62, startSec: 0.5, durationSec: 0.5 },
      ],
      120,
      score,
      "piano",
      "Recorte"
    );

    const [first] = track.measures[0].events;
    expect(durationBeats(first.duration)).toBeLessThanOrEqual(1);
  });

  it("asigna tablatura cuando el instrumento es de cuerdas", () => {
    const track = rawNotesToTrack(
      [{ midi: 40, startSec: 0, durationSec: 1 }], // E2 = 6ª al aire
      120,
      score,
      "guitar",
      "Guitarra"
    );

    const pitch = track.measures[0].events[0].pitches[0];
    expect(pitch.string).toBe(6);
    expect(pitch.fret).toBe(0);
  });

  it("modo conservador: notas rápidas seguidas no se fusionan como acorde", () => {
    // A 120 BPM la celda (semicorchea) dura 0.125s. Dos notas separadas
    // 0.055s redondean a la misma celda 0: el modo normal las fusiona, el
    // conservador (tolerancia de acorde = 0.05s) escribe dos eventos.
    const raw = [
      { midi: 60, startSec: 0, durationSec: 0.1 },
      { midi: 62, startSec: 0.055, durationSec: 0.1 },
    ];

    const normal = rawNotesToTrack([...raw], 120, score, "voice", "Normal");
    expect(normal.measures[0].events).toHaveLength(1);
    expect(normal.measures[0].events[0].pitches).toHaveLength(2);

    const conservative = rawNotesToTrack(
      [...raw],
      120,
      score,
      "voice",
      "Conservador",
      undefined,
      { conservative: true }
    );
    expect(conservative.measures[0].events).toHaveLength(2);
    expect(conservative.measures[0].events.map((e) => e.pitches[0].midi)).toEqual([
      60, 62,
    ]);
  });

  it("modo conservador: acordes reales (ataque simultáneo) sí se agrupan", () => {
    const track = rawNotesToTrack(
      [
        { midi: 60, startSec: 0, durationSec: 1 },
        { midi: 64, startSec: 0.01, durationSec: 1 },
      ],
      120,
      score,
      "piano",
      "Acorde real",
      undefined,
      { conservative: true }
    );

    expect(track.measures[0].events).toHaveLength(1);
    expect(track.measures[0].events[0].pitches.map((p) => p.midi).sort()).toEqual([
      60, 64,
    ]);
  });
});

describe("countTrackNotes", () => {
  it("cuenta cada nota de cada acorde, ignorando silencios", () => {
    const score = makeDefaultScore();
    const track = rawNotesToTrack(
      [
        { midi: 60, startSec: 0, durationSec: 0.5 },
        { midi: 64, startSec: 0.01, durationSec: 0.5 },
        { midi: 67, startSec: 1, durationSec: 0.5 },
      ],
      120,
      score,
      "piano",
      "Conteo"
    );
    expect(countTrackNotes(track)).toBe(3);
  });
});
