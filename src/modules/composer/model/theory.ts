// Teoría musical sobre tonal.js: detección de acordes y escalas
// (exacta y por similitud) y catálogos navegables por tónica.

import { Chord, ChordType, Midi, Note, ScaleType } from "tonal";

const PITCH_CLASSES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

export interface ChordMatch {
  symbol: string;
  name: string;
  /** 1 = coincidencia exacta con las notas tocadas. */
  score: number;
  /** Notas del acorde que no están sonando. */
  missing: string[];
  /** Notas sonando que no pertenecen al acorde. */
  extra: string[];
}

export interface ScaleMatch {
  name: string;
  tonic: string;
  score: number;
  notes: string[];
}

/** Pitch classes únicas (como nombres) de un conjunto de notas MIDI. */
function toPitchClasses(midis: number[]): string[] {
  const out = new Set<string>();
  for (const midi of midis) {
    const pc = Note.pitchClass(Midi.midiToNoteName(midi));
    if (pc) out.add(pc);
  }
  return [...out];
}

function chromaIndex(pc: string): number {
  // tonal devuelve null o NaN según el build para notas inválidas
  const chroma = Note.chroma(pc);
  return typeof chroma === "number" && Number.isFinite(chroma) ? chroma : -1;
}

/** Expande la máscara chroma de tonal ("101010...") a un set de índices 0-11. */
function chromaMaskToSet(mask: string, offset: number): Set<number> {
  const set = new Set<number>();
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === "1") set.add((i + offset) % 12);
  }
  return set;
}

/**
 * Acordes más parecidos a las notas dadas.
 * Primero coincidencias exactas de Chord.detect; luego se puntúa cada tipo
 * del diccionario contra cada posible tónica presente para sugerir parciales.
 */
export function detectChords(midis: number[], limit = 6): ChordMatch[] {
  const pcs = toPitchClasses(midis);
  if (pcs.length === 0) return [];

  const played = new Set(pcs.map(chromaIndex));
  const matches: ChordMatch[] = [];
  const seen = new Set<string>();

  for (const symbol of Chord.detect(pcs)) {
    const chord = Chord.get(symbol);
    if (chord.empty || seen.has(symbol)) continue;
    seen.add(symbol);
    matches.push({
      symbol,
      name: chord.name || symbol,
      score: 1,
      missing: [],
      extra: [],
    });
  }

  for (const root of pcs) {
    const rootChroma = chromaIndex(root);
    for (const type of ChordType.all()) {
      if (type.intervals.length < 3) continue;

      const chordSet = chromaMaskToSet(type.chroma ?? "", rootChroma);
      let overlap = 0;
      for (const c of played) if (chordSet.has(c)) overlap++;

      const missing = [...chordSet].filter((c) => !played.has(c));
      const extra = [...played].filter((c) => !chordSet.has(c));

      // Premia cubrir lo tocado; penaliza faltantes y notas ajenas.
      const score =
        overlap / played.size - 0.15 * missing.length - 0.2 * extra.length;
      if (overlap < 2 || score <= 0.4) continue;

      const symbol = `${root}${type.aliases[0] ?? type.name}`;
      if (seen.has(symbol)) continue;
      seen.add(symbol);

      matches.push({
        symbol,
        name: `${root} ${type.name || type.aliases[0]}`,
        score: Math.min(score, 0.99),
        missing: missing.map((c) => PITCH_CLASSES[c]),
        extra: extra.map((c) => PITCH_CLASSES[c]),
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Escalas que contienen TODAS las notas dadas, ordenadas por qué tan
 * "ajustada" es la escala (menos notas sobrantes = mejor puntaje).
 */
export function detectScales(midis: number[], limit = 8): ScaleMatch[] {
  const pcs = toPitchClasses(midis);
  if (pcs.length === 0) return [];
  const played = new Set(pcs.map(chromaIndex));

  const matches: ScaleMatch[] = [];
  for (const type of ScaleType.all()) {
    if (type.intervals.length < 5) continue; // descarta fragmentos triviales

    for (let tonic = 0; tonic < 12; tonic++) {
      const scaleSet = chromaMaskToSet(type.chroma, tonic);

      let contained = true;
      for (const c of played) {
        if (!scaleSet.has(c)) {
          contained = false;
          break;
        }
      }
      if (!contained) continue;

      matches.push({
        name: type.name,
        tonic: PITCH_CLASSES[tonic],
        score: played.size / scaleSet.size,
        notes: [...scaleSet].sort((a, b) => a - b).map((c) => PITCH_CLASSES[c]),
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}

export interface CatalogChord {
  symbol: string;
  name: string;
  notes: string[];
}

/** Todos los tipos de acorde del diccionario para una tónica. */
export function chordCatalog(tonic: string): CatalogChord[] {
  const out: CatalogChord[] = [];
  for (const type of ChordType.all()) {
    const alias = type.aliases[0] ?? type.name;
    const chord = Chord.getChord(alias, tonic);
    if (chord.notes.length === 0) continue;
    out.push({
      symbol: `${tonic}${type.aliases[0] ?? ""}`,
      name: chord.name || `${tonic}${alias}`,
      notes: chord.notes,
    });
  }
  return out;
}

export interface CatalogScale {
  name: string;
  notes: string[];
}

/** Todas las escalas/modos del diccionario para una tónica. */
export function scaleCatalog(tonic: string): CatalogScale[] {
  const offset = chromaIndex(tonic);
  return ScaleType.all().map((type) => ({
    name: type.name,
    notes: [...chromaMaskToSet(type.chroma, offset)]
      .sort((a, b) => a - b)
      .map((c) => PITCH_CLASSES[c]),
  }));
}

export function midiToName(midi: number): string {
  return Midi.midiToNoteName(midi);
}

export function nameToMidi(name: string): number | null {
  return Note.midi(name);
}

/** Chromas (0-11) de las notas de una tonalidad, para resaltar en la UI. */
export function keyNotes(key: string): Set<number> {
  const [tonic, ...rest] = key.split(" ");
  const mode = rest.join(" ") || "major";
  const scale = ScaleType.get(mode === "minor" ? "aeolian" : mode);
  const offset = chromaIndex(tonic);
  if (scale.empty || offset < 0) return new Set();
  return chromaMaskToSet(scale.chroma, offset);
}
