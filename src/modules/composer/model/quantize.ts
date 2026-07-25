// Cuantización: convierte notas crudas de la transcripción (en segundos)
// a compases y figuras del modelo, alineando a una rejilla de semicorcheas.

import { assignFingering } from "./fingering";
import {
  beatsPerMeasure,
  makeTrack,
  newId,
  type Duration,
  type Instrument,
  type Score,
  type ScoreEvent,
  type Track,
} from "./score";

export interface RawNote {
  midi: number;
  startSec: number;
  durationSec: number;
  velocity?: number;
}

export interface QuantizeOptions {
  /**
   * Modo conservador: notas que caen en la misma celda pero con ataques
   * claramente distintos NO se fusionan como acorde; la más tardía se empuja
   * a la celda siguiente. Preserva melodías rápidas (tarareos) que el modo
   * normal convertiría en acordes.
   */
  conservative?: boolean;
}

/** Rejilla de cuantización: semicorchea, en beats. */
export const GRID = 0.25;

/** Notas escritas en una pista (cada nota de un acorde cuenta). */
export function countTrackNotes(track: Track): number {
  let count = 0;
  for (const measure of track.measures) {
    for (const event of measure.events) {
      if (!event.isRest) count += event.pitches.length;
    }
  }
  return count;
}

// Figuras disponibles ordenadas por duración en beats
const FIGURES: { duration: Duration; beats: number }[] = [
  { duration: { name: "16", dotted: false }, beats: 0.25 },
  { duration: { name: "16", dotted: true }, beats: 0.375 },
  { duration: { name: "8", dotted: false }, beats: 0.5 },
  { duration: { name: "8", dotted: true }, beats: 0.75 },
  { duration: { name: "q", dotted: false }, beats: 1 },
  { duration: { name: "q", dotted: true }, beats: 1.5 },
  { duration: { name: "h", dotted: false }, beats: 2 },
  { duration: { name: "h", dotted: true }, beats: 3 },
  { duration: { name: "w", dotted: false }, beats: 4 },
];

/** Figura cuya duración se acerca más a los beats dados. */
export function beatsToDuration(beats: number): Duration {
  let best = FIGURES[0];
  let bestDiff = Math.abs(best.beats - beats);
  for (const f of FIGURES) {
    const diff = Math.abs(f.beats - beats);
    if (diff < bestDiff) {
      best = f;
      bestDiff = diff;
    }
  }
  return best.duration;
}

function snapDuration(beats: number): number {
  return Math.max(GRID, Math.round(beats / GRID) * GRID);
}

/**
 * Cuantiza notas crudas a una pista nueva.
 * Notas que caen en la misma celda de inicio se agrupan como acorde;
 * la duración de cada grupo se recorta para no pisar al siguiente
 * ni salirse del compás.
 */
export function rawNotesToTrack(
  raw: RawNote[],
  bpm: number,
  score: Score,
  instrument: Instrument,
  name: string,
  sound?: string,
  options?: QuantizeOptions
): Track {
  const secPerBeat = 60 / bpm;
  const measureBeats = beatsPerMeasure(score);
  const conservative = options?.conservative ?? false;
  // Ataques a menos de 40% de celda se consideran simultáneos (acorde real)
  const chordToleranceSec = 0.4 * GRID * secPerBeat;

  // 1. Agrupar por celda de inicio en la rejilla
  const byStart = new Map<number, RawNote[]>();
  const sorted = [...raw].sort((a, b) => a.startSec - b.startSec);
  for (const note of sorted) {
    let cell = Math.round(note.startSec / secPerBeat / GRID) * GRID;
    if (conservative) {
      // Si la celda ya tiene notas que empezaron claramente antes, esta nota
      // es parte de una secuencia rápida, no de un acorde: va a la celda
      // siguiente libre en vez de fusionarse.
      let existing = byStart.get(cell);
      while (
        existing &&
        note.startSec - existing[0].startSec > chordToleranceSec
      ) {
        cell += GRID;
        existing = byStart.get(cell);
      }
    }
    const group = byStart.get(cell);
    if (group) group.push(note);
    else byStart.set(cell, [note]);
  }

  const starts = [...byStart.keys()].sort((a, b) => a - b);

  // 2. Calcular compases necesarios según la última nota
  let lastBeat = 0;
  for (const start of starts) {
    const group = byStart.get(start)!;
    for (const note of group) {
      lastBeat = Math.max(
        lastBeat,
        start + snapDuration(note.durationSec / secPerBeat)
      );
    }
  }
  const numMeasures = Math.max(1, Math.ceil(lastBeat / measureBeats));

  const track = makeTrack(instrument, numMeasures);
  track.name = name;
  if (sound) track.sound = sound;

  // 3. Escribir eventos
  starts.forEach((startBeat, i) => {
    const group = byStart.get(startBeat)!;
    const measureIdx = Math.floor(startBeat / measureBeats);
    const startInMeasure = startBeat - measureIdx * measureBeats;

    let durBeats = 0;
    for (const note of group) {
      durBeats = Math.max(durBeats, snapDuration(note.durationSec / secPerBeat));
    }
    const next = starts[i + 1];
    if (next !== undefined && startBeat + durBeats > next) {
      durBeats = next - startBeat;
    }
    if (startInMeasure + durBeats > measureBeats) {
      durBeats = measureBeats - startInMeasure;
    }
    // Nunca descartar una nota por quedar corta: mínimo una semicorchea
    durBeats = Math.max(GRID, durBeats);

    const midis = [...new Set(group.map((n) => n.midi))];
    const event: ScoreEvent = {
      id: newId(),
      start: startInMeasure,
      duration: beatsToDuration(durBeats),
      isRest: false,
      pitches: midis.map((midi) => ({ midi })),
    };

    if (measureIdx < track.measures.length) {
      track.measures[measureIdx].events.push(event);
    }
  });

  if (track.tuning) assignFingering(track);
  return track;
}
