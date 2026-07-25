import { describe, expect, it } from "vitest";

import { assignFingering } from "@/modules/composer/model/fingering";
import {
  makeTrack,
  newId,
  type ScoreEvent,
} from "@/modules/composer/model/score";

function noteEvent(midis: number[], start = 0): ScoreEvent {
  return {
    id: newId(),
    start,
    duration: { name: "q", dotted: false },
    isRest: false,
    pitches: midis.map((midi) => ({ midi })),
  };
}

describe("assignFingering", () => {
  it("prefiere cuerdas al aire", () => {
    const track = makeTrack("guitar", 1);
    track.measures[0].events.push(noteEvent([40])); // E2
    assignFingering(track);

    const pitch = track.measures[0].events[0].pitches[0];
    expect(pitch.string).toBe(6);
    expect(pitch.fret).toBe(0);
  });

  it("asigna cuerdas distintas a las notas de un acorde", () => {
    const track = makeTrack("guitar", 1);
    track.measures[0].events.push(noteEvent([40, 47, 52])); // E2 B2 E3 (power chord E)
    assignFingering(track);

    const strings = track.measures[0].events[0].pitches.map((p) => p.string);
    expect(new Set(strings).size).toBe(strings.length);
  });

  it("respeta el capo", () => {
    const track = makeTrack("guitar", 1);
    track.capo = 2;
    track.measures[0].events.push(noteEvent([42])); // F#2 = 6ª al aire con capo 2
    assignFingering(track);

    const pitch = track.measures[0].events[0].pitches[0];
    expect(pitch.string).toBe(6);
    expect(pitch.fret).toBe(0);
  });

  it("notas fuera de rango quedan sin tab", () => {
    const track = makeTrack("bass", 1);
    track.measures[0].events.push(noteEvent([100])); // imposible en bajo
    assignFingering(track);

    const pitch = track.measures[0].events[0].pitches[0];
    expect(pitch.string).toBeUndefined();
    expect(pitch.fret).toBeUndefined();
  });

  it("ignora pistas sin afinación", () => {
    const track = makeTrack("piano", 1);
    track.measures[0].events.push(noteEvent([60]));
    assignFingering(track);
    expect(track.measures[0].events[0].pitches[0].string).toBeUndefined();
  });
});
