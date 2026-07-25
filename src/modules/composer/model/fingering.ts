// Digitación automática para tablatura (guitarra/bajo).
// Para cada evento se eligen cuerda+traste minimizando una función de costo:
// posiciones bajas y cuerdas al aire baratas, saltos de mano y
// estiramientos grandes caros. La posición de la mano se arrastra
// entre eventos consecutivos.

import type { Track } from "./score";

interface FretPosition {
  /** Índice 0 = cuerda más aguda. */
  stringIdx: number;
  fret: number;
}

const MAX_FRET = 19;
const MAX_COMBOS = 400;

/** Todas las posiciones posibles para una nota MIDI en la afinación dada. */
function candidatePositions(
  midi: number,
  tuning: number[],
  capo: number
): FretPosition[] {
  const out: FretPosition[] = [];
  for (let s = 0; s < tuning.length; s++) {
    const fret = midi - tuning[s] - capo;
    if (fret >= 0 && fret <= MAX_FRET) out.push({ stringIdx: s, fret });
  }
  return out;
}

/** Costo intrínseco: cuerda al aire gratis, trastes altos progresivamente caros. */
function staticCost(pos: FretPosition): number {
  return pos.fret === 0 ? 0 : pos.fret * 0.3;
}

/** Costo de mover la mano respecto de la posición anterior. */
function movementCost(pos: FretPosition, prevFrets: number[]): number {
  if (pos.fret === 0) return 0;
  const pressed = prevFrets.filter((f) => f > 0);
  if (pressed.length === 0) return 0;
  const handCenter = pressed.reduce((a, b) => a + b, 0) / pressed.length;
  return Math.abs(pos.fret - handCenter);
}

/**
 * Combinaciones válidas de posiciones para un acorde
 * (una cuerda no puede sonar dos notas a la vez).
 */
function chordCombinations(
  midis: number[],
  tuning: number[],
  capo: number
): FretPosition[][] {
  const perNote = midis.map((m) => candidatePositions(m, tuning, capo));
  if (perNote.some((options) => options.length === 0)) return [];

  const combos: FretPosition[][] = [];
  const usedStrings = new Set<number>();
  const current: FretPosition[] = [];

  function explore(noteIdx: number) {
    if (combos.length >= MAX_COMBOS) return;
    if (noteIdx === perNote.length) {
      combos.push([...current]);
      return;
    }
    for (const pos of perNote[noteIdx]) {
      if (usedStrings.has(pos.stringIdx)) continue;
      usedStrings.add(pos.stringIdx);
      current.push(pos);
      explore(noteIdx + 1);
      current.pop();
      usedStrings.delete(pos.stringIdx);
    }
  }

  explore(0);
  return combos;
}

function combinationCost(combo: FretPosition[], prevFrets: number[]): number {
  let cost = 0;
  for (const pos of combo) {
    cost += staticCost(pos) + movementCost(pos, prevFrets);
  }
  // Estiramiento entre trastes pisados del mismo acorde
  const pressed = combo.filter((p) => p.fret > 0).map((p) => p.fret);
  if (pressed.length > 1) {
    const span = Math.max(...pressed) - Math.min(...pressed);
    cost += span > 4 ? (span - 4) * 5 : span * 0.5;
  }
  return cost;
}

/**
 * Recalcula cuerda/traste de todos los eventos de la pista, in-place,
 * en orden temporal. Si una nota no cabe en la afinación queda sin tab
 * (se muestra solo en pentagrama).
 */
export function assignFingering(track: Track): void {
  const tuning = track.tuning;
  if (!tuning) return;
  const capo = track.capo ?? 0;

  let prevFrets: number[] = [];

  for (const measure of track.measures) {
    const events = [...measure.events].sort((a, b) => a.start - b.start);

    for (const ev of events) {
      if (ev.isRest || ev.pitches.length === 0) continue;

      const combos = chordCombinations(
        ev.pitches.map((p) => p.midi),
        tuning,
        capo
      );

      if (combos.length === 0) {
        for (const p of ev.pitches) {
          delete p.string;
          delete p.fret;
        }
        continue;
      }

      let best = combos[0];
      let bestCost = Infinity;
      for (const combo of combos) {
        const cost = combinationCost(combo, prevFrets);
        if (cost < bestCost) {
          bestCost = cost;
          best = combo;
        }
      }

      ev.pitches.forEach((p, i) => {
        p.string = best[i].stringIdx + 1; // 1-based para la UI
        p.fret = best[i].fret;
      });
      prevFrets = best.map((p) => p.fret);
    }
  }
}
