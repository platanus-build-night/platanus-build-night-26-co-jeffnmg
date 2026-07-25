import { beforeEach, describe, expect, it } from "vitest";

import {
  durationBeats,
  makeDefaultScore,
} from "@/modules/composer/model/score";
import { useComposer } from "@/modules/composer/state/composer-store";

/** Deja el store en estado limpio antes de cada test. */
function resetStore() {
  const store = useComposer.getState();
  store.setScore(makeDefaultScore());
  useComposer.setState({
    inputDuration: { name: "q", dotted: false },
    loop: null,
    playbackSpeed: 1,
    isPlaying: false,
    multitrack: true,
  });
}

const state = () => useComposer.getState();

beforeEach(resetStore);

describe("addNote", () => {
  it("inserta al final del compás activo y selecciona el evento", () => {
    state().addNote(60);
    state().addNote(64);

    const track = state().score.tracks[0];
    const events = track.measures[0].events;
    expect(events).toHaveLength(2);
    expect(events[0].start).toBe(0);
    expect(events[1].start).toBe(1); // después de una negra
    expect(events[1].pitches[0].midi).toBe(64);
    expect(state().selection?.eventId).toBe(events[1].id);
  });

  it("usa la figura activa (inputDuration)", () => {
    state().setInputDuration({ name: "h", dotted: false });
    state().addNote(60);
    state().addNote(62);

    const events = state().score.tracks[0].measures[0].events;
    expect(events[1].start).toBe(2);
    expect(durationBeats(events[1].duration)).toBe(2);
  });

  it("rechaza notas cuando el compás está lleno", () => {
    state().setInputDuration({ name: "w", dotted: false });
    state().addNote(60); // llena el 4/4
    state().addNote(62); // no cabe

    expect(state().score.tracks[0].measures[0].events).toHaveLength(1);
  });

  it("asigna tablatura en pistas de cuerdas", () => {
    state().addNote(40); // E2 = 6ª al aire
    const pitch = state().score.tracks[0].measures[0].events[0].pitches[0];
    expect(pitch.string).toBe(6);
    expect(pitch.fret).toBe(0);
  });
});

describe("toggleChordNote", () => {
  it("agrega y quita notas del evento seleccionado", () => {
    state().addNote(60);
    state().toggleChordNote(64);
    state().toggleChordNote(67);

    const midis = () =>
      state()
        .score.tracks[0].measures[0].events[0].pitches.map((p) => p.midi)
        .sort((a, b) => a - b);
    expect(midis()).toEqual([60, 64, 67]);

    state().toggleChordNote(64);
    expect(midis()).toEqual([60, 67]);
  });

  it("no deja el evento sin notas", () => {
    state().addNote(60);
    state().toggleChordNote(60);
    expect(state().score.tracks[0].measures[0].events[0].pitches).toHaveLength(1);
  });

  it("sin selección inserta una nota nueva", () => {
    state().select(null);
    state().toggleChordNote(62);
    expect(state().score.tracks[0].measures[0].events).toHaveLength(1);
  });
});

describe("addRest y deleteSelected", () => {
  it("inserta silencios", () => {
    state().addRest();
    const [rest] = state().score.tracks[0].measures[0].events;
    expect(rest.isRest).toBe(true);
    expect(rest.pitches).toEqual([]);
  });

  it("borra el evento seleccionado y compacta el compás", () => {
    state().addNote(60);
    state().addNote(64);
    state().addNote(67);
    const events = () => state().score.tracks[0].measures[0].events;
    const second = events()[1];

    state().select({
      trackId: state().score.tracks[0].id,
      measureIdx: 0,
      eventId: second.id,
    });
    state().deleteSelected();

    expect(events()).toHaveLength(2);
    // el tercero retrocede al hueco del segundo
    expect(events()[1].start).toBe(1);
    expect(events()[1].pitches[0].midi).toBe(67);
    expect(state().selection?.eventId).toBeNull();
  });
});

describe("pistas y compases", () => {
  it("addTrack agrega con la misma cantidad de compases y la activa", () => {
    state().addMeasure(); // guitarra pasa a 5
    state().addTrack("bass");

    const tracks = state().score.tracks;
    expect(tracks).toHaveLength(2);
    expect(tracks[1].instrument).toBe("bass");
    expect(tracks[1].measures).toHaveLength(5);
    expect(state().activeTrackId).toBe(tracks[1].id);
  });

  it("removeTrack elimina y reasigna la pista activa", () => {
    state().addTrack("drums");
    const drumsId = state().activeTrackId;
    state().removeTrack(drumsId);

    expect(state().score.tracks).toHaveLength(1);
    expect(state().activeTrackId).toBe(state().score.tracks[0].id);
  });

  it("addMeasure agrega un compás a todas las pistas", () => {
    state().addTrack("piano");
    state().addMeasure();
    for (const t of state().score.tracks) {
      expect(t.measures).toHaveLength(5);
    }
  });
});

describe("letra y transposición", () => {
  it("setLyric ancla texto al evento seleccionado", () => {
    state().addNote(60);
    state().setLyric("la");
    expect(state().score.tracks[0].measures[0].events[0].lyric).toBe("la");

    state().setLyric("");
    expect(state().score.tracks[0].measures[0].events[0].lyric).toBeUndefined();
  });

  it("transposeTrack mueve todas las notas con clamp 0-127", () => {
    state().addNote(60);
    const trackId = state().score.tracks[0].id;
    state().transposeTrack(trackId, 12);
    expect(state().score.tracks[0].measures[0].events[0].pitches[0].midi).toBe(72);

    state().transposeTrack(trackId, 100);
    expect(state().score.tracks[0].measures[0].events[0].pitches[0].midi).toBe(127);
  });

  it("no transpone la batería", () => {
    state().addTrack("drums");
    const drumsId = state().activeTrackId;
    state().select({ trackId: drumsId, measureIdx: 0, eventId: null });
    state().addNote(36);
    state().transposeTrack(drumsId, 12);

    const drums = state().score.tracks.find((t) => t.id === drumsId)!;
    expect(drums.measures[0].events[0].pitches[0].midi).toBe(36);
  });
});

describe("setScore y updateScore", () => {
  it("setScore normaliza compases y resetea selección", () => {
    const s = makeDefaultScore("Otra");
    s.tracks.push({ ...s.tracks[0], id: "x", measures: [{ events: [] }] });
    state().addNote(60); // deja selección previa

    state().setScore(s);
    expect(state().selection).toBeNull();
    expect(state().score.title).toBe("Otra");
    // ambas pistas quedan con 4 compases
    for (const t of state().score.tracks) expect(t.measures).toHaveLength(4);
  });

  it("updateScore no muta el score anterior", () => {
    const before = state().score;
    state().updateScore((s) => {
      s.bpm = 140;
    });
    expect(before.bpm).toBe(100);
    expect(state().score.bpm).toBe(140);
  });
});
