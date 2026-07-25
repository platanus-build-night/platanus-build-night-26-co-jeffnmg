// Store Zustand del compositor: partitura en edición, selección,
// preferencias de entrada y estado de reproducción.
// Toda mutación pasa por updateScore(), que clona el score, aplica el
// cambio y normaliza compases — así los componentes re-renderizan por
// identidad nueva y nunca mutamos el estado anterior.

import { create } from "zustand";

import { assignFingering } from "../model/fingering";
import {
  beatsPerMeasure,
  durationBeats,
  makeDefaultScore,
  makeTrack,
  measureUsedBeats,
  newId,
  normalizeMeasureCount,
  type Duration,
  type Instrument,
  type Score,
  type ScoreEvent,
} from "../model/score";

export interface Selection {
  trackId: string;
  measureIdx: number;
  /** null = compás seleccionado sin evento concreto. */
  eventId: string | null;
}

const EPSILON = 1e-6;

interface ComposerState {
  score: Score;
  selection: Selection | null;
  /** Figura activa con la que se insertan notas/silencios nuevos. */
  inputDuration: Duration;
  /** Loop en compases [desde, hasta] inclusive, o null. */
  loop: [number, number] | null;
  playbackSpeed: number;
  isPlaying: boolean;
  /** true = ver todas las pistas; false = solo la activa. */
  multitrack: boolean;
  activeTrackId: string;

  setScore: (score: Score) => void;
  updateScore: (mutate: (score: Score) => void) => void;
  select: (selection: Selection | null) => void;
  setInputDuration: (d: Duration) => void;
  setLoop: (loop: [number, number] | null) => void;
  setPlaybackSpeed: (speed: number) => void;
  setPlaying: (playing: boolean) => void;
  setMultitrack: (multitrack: boolean) => void;
  setActiveTrack: (trackId: string) => void;

  addTrack: (instrument: Instrument) => void;
  removeTrack: (trackId: string) => void;
  addMeasure: () => void;
  addNote: (midi: number) => void;
  toggleChordNote: (midi: number) => void;
  addRest: () => void;
  deleteSelected: () => void;
  setLyric: (text: string) => void;
  transposeTrack: (trackId: string, semitones: number) => void;
}

/**
 * Dónde insertar el siguiente evento en un compás: justo después del
 * último evento existente. null si la pista o el compás no existen.
 */
function nextInsertStart(
  score: Score,
  trackId: string,
  measureIdx: number
): number | null {
  const track = score.tracks.find((t) => t.id === trackId);
  const measure = track?.measures[measureIdx];
  if (!measure) return null;
  return measureUsedBeats(measure);
}

export const useComposer = create<ComposerState>((set, get) => {
  const initialScore = makeDefaultScore();

  return {
    score: initialScore,
    selection: null,
    inputDuration: { name: "q", dotted: false },
    loop: null,
    playbackSpeed: 1,
    isPlaying: false,
    multitrack: true,
    activeTrackId: initialScore.tracks[0]?.id ?? "",

    setScore: (score) => {
      normalizeMeasureCount(score);
      set({
        score,
        activeTrackId: score.tracks[0]?.id ?? "",
        selection: null,
      });
    },

    updateScore: (mutate) => {
      const draft = structuredClone(get().score);
      mutate(draft);
      normalizeMeasureCount(draft);
      set({ score: draft });
    },

    select: (selection) => set({ selection }),
    setInputDuration: (inputDuration) => set({ inputDuration }),
    setLoop: (loop) => set({ loop }),
    setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
    setPlaying: (isPlaying) => set({ isPlaying }),
    setMultitrack: (multitrack) => set({ multitrack }),
    setActiveTrack: (activeTrackId) => set({ activeTrackId }),

    addTrack: (instrument) => {
      get().updateScore((s) => {
        const measures = Math.max(1, ...s.tracks.map((t) => t.measures.length));
        s.tracks.push(makeTrack(instrument, measures));
      });
      const { tracks } = get().score;
      set({ activeTrackId: tracks[tracks.length - 1].id });
    },

    removeTrack: (trackId) => {
      get().updateScore((s) => {
        s.tracks = s.tracks.filter((t) => t.id !== trackId);
      });
      if (get().activeTrackId === trackId) {
        set({ activeTrackId: get().score.tracks[0]?.id ?? "", selection: null });
      }
    },

    addMeasure: () => {
      get().updateScore((s) => {
        for (const t of s.tracks) t.measures.push({ events: [] });
      });
    },

    addNote: (midi) => {
      const { selection, inputDuration, activeTrackId } = get();
      const trackId = selection?.trackId ?? activeTrackId;
      const measureIdx = selection?.measureIdx ?? 0;

      let insertedId: string | null = null;
      get().updateScore((s) => {
        const track = s.tracks.find((t) => t.id === trackId);
        if (!track) return;
        const start = nextInsertStart(s, trackId, measureIdx);
        if (start === null) return;
        // No insertar si la figura no cabe en lo que queda del compás
        if (start + durationBeats(inputDuration) > beatsPerMeasure(s) + EPSILON) {
          return;
        }
        const event: ScoreEvent = {
          id: newId(),
          start,
          duration: { ...inputDuration },
          isRest: false,
          pitches: [{ midi }],
        };
        track.measures[measureIdx].events.push(event);
        insertedId = event.id;
        if (track.tuning) assignFingering(track);
      });

      if (insertedId) {
        set({ selection: { trackId, measureIdx, eventId: insertedId } });
      }
    },

    toggleChordNote: (midi) => {
      const { selection } = get();
      // Sin evento seleccionado, se comporta como insertar nota
      if (!selection?.eventId) {
        get().addNote(midi);
        return;
      }
      get().updateScore((s) => {
        const track = s.tracks.find((t) => t.id === selection.trackId);
        const event = track?.measures[selection.measureIdx]?.events.find(
          (e) => e.id === selection.eventId
        );
        if (!track || !event || event.isRest) return;

        const existing = event.pitches.findIndex((p) => p.midi === midi);
        if (existing >= 0) {
          // Nunca dejar el evento sin notas: la última no se quita
          if (event.pitches.length > 1) event.pitches.splice(existing, 1);
        } else {
          event.pitches.push({ midi });
        }
        if (track.tuning) assignFingering(track);
      });
    },

    addRest: () => {
      const { selection, inputDuration, activeTrackId } = get();
      const trackId = selection?.trackId ?? activeTrackId;
      const measureIdx = selection?.measureIdx ?? 0;

      get().updateScore((s) => {
        const track = s.tracks.find((t) => t.id === trackId);
        if (!track) return;
        const start = nextInsertStart(s, trackId, measureIdx);
        if (start === null) return;
        if (start + durationBeats(inputDuration) > beatsPerMeasure(s) + EPSILON) {
          return;
        }
        track.measures[measureIdx].events.push({
          id: newId(),
          start,
          duration: { ...inputDuration },
          isRest: true,
          pitches: [],
        });
      });
    },

    deleteSelected: () => {
      const { selection } = get();
      if (!selection?.eventId) return;

      get().updateScore((s) => {
        const track = s.tracks.find((t) => t.id === selection.trackId);
        const measure = track?.measures[selection.measureIdx];
        if (!track || !measure) return;

        const idx = measure.events.findIndex((e) => e.id === selection.eventId);
        if (idx < 0) return;
        const [removed] = measure.events.splice(idx, 1);

        // Compactar: los eventos posteriores retroceden el hueco liberado
        const gap = durationBeats(removed.duration);
        for (const e of measure.events) {
          if (e.start > removed.start) e.start -= gap;
        }
        if (track.tuning) assignFingering(track);
      });

      set({ selection: { ...selection, eventId: null } });
    },

    setLyric: (text) => {
      const { selection } = get();
      if (!selection?.eventId) return;
      get().updateScore((s) => {
        const track = s.tracks.find((t) => t.id === selection.trackId);
        const event = track?.measures[selection.measureIdx]?.events.find(
          (e) => e.id === selection.eventId
        );
        if (event) event.lyric = text || undefined;
      });
    },

    transposeTrack: (trackId, semitones) => {
      get().updateScore((s) => {
        const track = s.tracks.find((t) => t.id === trackId);
        // La batería no se transpone: sus MIDI son pads, no alturas
        if (!track || track.instrument === "drums") return;
        for (const measure of track.measures) {
          for (const event of measure.events) {
            for (const pitch of event.pitches) {
              pitch.midi = Math.min(127, Math.max(0, pitch.midi + semitones));
            }
          }
        }
        if (track.tuning) assignFingering(track);
      });
    },
  };
});
