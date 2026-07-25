// Modelo central de la partitura de JamRoom.
// Se serializa completo en Song.scoreJson y lo consumen el editor,
// el reproductor y los exportadores.

export type Instrument = "piano" | "guitar" | "bass" | "drums" | "voice";

export type DurationName = "w" | "h" | "q" | "8" | "16";

export interface Duration {
  name: DurationName;
  dotted: boolean;
}

const BASE_BEATS: Record<DurationName, number> = {
  w: 4,
  h: 2,
  q: 1,
  "8": 0.5,
  "16": 0.25,
};

/** Duración de una figura en beats (negras). El puntillo suma la mitad. */
export function durationBeats(d: Duration): number {
  return BASE_BEATS[d.name] * (d.dotted ? 1.5 : 1);
}

export interface NotePitch {
  midi: number;
  /** Cuerda 1 = la más aguda (solo guitarra/bajo, para tablatura). */
  string?: number;
  fret?: number;
}

export interface ScoreEvent {
  id: string;
  /** Offset en beats desde el inicio del compás. */
  start: number;
  duration: Duration;
  isRest: boolean;
  /** Varias alturas = acorde. En batería, notas del mapa GM de percusión. */
  pitches: NotePitch[];
  /** Sílaba/palabra de la letra anclada a esta nota. */
  lyric?: string;
}

export interface Measure {
  events: ScoreEvent[];
}

export interface Track {
  id: string;
  name: string;
  instrument: Instrument;
  /** MIDI de cuerdas al aire, de aguda a grave (solo guitarra/bajo). */
  tuning?: number[];
  capo?: number;
  /** Id de variante del catálogo de sounds.ts. */
  sound?: string;
  volume: number; // 0..1
  pan: number; // -1..1
  mute: boolean;
  solo: boolean;
  /** Semitonos que se suman al reproducir (no afecta la notación). */
  transpose: number;
  visible: boolean;
  measures: Measure[];
}

export interface Score {
  title: string;
  bpm: number;
  timeSig: [number, number];
  /** Ej. "C major" | "A minor". */
  key: string;
  tracks: Track[];
}

// Afinaciones estándar (MIDI, de la cuerda más aguda a la más grave)
export const STANDARD_GUITAR_TUNING = [64, 59, 55, 50, 45, 40]; // E4 B3 G3 D3 A2 E2
export const STANDARD_BASS_TUNING = [43, 38, 33, 28]; // G2 D2 A1 E1

/** Subconjunto útil del mapa GM de percusión (canal 10). */
export const DRUM_NOTES: { midi: number; label: string }[] = [
  { midi: 36, label: "Bombo" },
  { midi: 38, label: "Redoblante" },
  { midi: 42, label: "Hi-hat cerrado" },
  { midi: 46, label: "Hi-hat abierto" },
  { midi: 49, label: "Crash" },
  { midi: 51, label: "Ride" },
  { midi: 45, label: "Tom medio" },
  { midi: 41, label: "Tom de piso" },
];

let seq = 0;
/** Id único corto para eventos/pistas (no criptográfico). */
export function newId(prefix = "e"): string {
  seq = (seq + 1) % Number.MAX_SAFE_INTEGER;
  return `${prefix}${Date.now().toString(36)}${seq.toString(36)}`;
}

/** Beats por compás según la métrica (ej. 4/4 → 4, 6/8 → 3). */
export function beatsPerMeasure(score: Score): number {
  const [num, den] = score.timeSig;
  return num * (4 / den);
}

/** Último beat ocupado dentro de un compás. */
export function measureUsedBeats(m: Measure): number {
  let used = 0;
  for (const ev of m.events) {
    used = Math.max(used, ev.start + durationBeats(ev.duration));
  }
  return used;
}

const TRACK_NAMES: Record<Instrument, string> = {
  piano: "Piano",
  guitar: "Guitarra",
  bass: "Bajo",
  drums: "Batería",
  voice: "Voz",
};

const TRACK_DEFAULT_SOUND: Record<Instrument, string> = {
  piano: "grand",
  guitar: "acoustic",
  bass: "finger",
  drums: "electronic",
  voice: "choir",
};

export function makeTrack(instrument: Instrument, numMeasures: number): Track {
  let tuning: number[] | undefined;
  if (instrument === "guitar") tuning = [...STANDARD_GUITAR_TUNING];
  if (instrument === "bass") tuning = [...STANDARD_BASS_TUNING];

  return {
    id: newId("t"),
    name: TRACK_NAMES[instrument],
    instrument,
    tuning,
    capo: 0,
    sound: TRACK_DEFAULT_SOUND[instrument],
    volume: 0.8,
    pan: 0,
    mute: false,
    solo: false,
    transpose: 0,
    visible: true,
    measures: Array.from({ length: numMeasures }, () => ({ events: [] })),
  };
}

export function makeDefaultScore(title = "Nueva composición"): Score {
  return {
    title,
    bpm: 100,
    timeSig: [4, 4],
    key: "C major",
    tracks: [makeTrack("guitar", 4)],
  };
}

/** Beat absoluto (desde el inicio de la canción) de un evento. */
export function eventAbsoluteBeat(
  score: Score,
  measureIdx: number,
  ev: ScoreEvent
): number {
  return measureIdx * beatsPerMeasure(score) + ev.start;
}

export function totalMeasures(score: Score): number {
  let max = 0;
  for (const t of score.tracks) max = Math.max(max, t.measures.length);
  return max;
}

/** Iguala la cantidad de compases de todas las pistas (rellena con vacíos). */
export function normalizeMeasureCount(score: Score): void {
  const target = totalMeasures(score);
  for (const t of score.tracks) {
    while (t.measures.length < target) t.measures.push({ events: [] });
  }
}

/**
 * Convierte JSON arbitrario (scores guardados con versiones anteriores del
 * modelo) en un Score utilizable, rellenando defaults donde falte algo.
 */
export function coerceScore(value: unknown, fallbackTitle = "Nueva composición"): Score {
  if (typeof value !== "object" || value === null) {
    return makeDefaultScore(fallbackTitle);
  }
  const raw = value as Partial<Score> & { tracks?: unknown };

  if (!Array.isArray(raw.tracks) || raw.tracks.length === 0) {
    const score = makeDefaultScore(typeof raw.title === "string" ? raw.title : fallbackTitle);
    if (typeof raw.bpm === "number") score.bpm = raw.bpm;
    if (typeof raw.key === "string") score.key = raw.key;
    if (Array.isArray(raw.timeSig) && raw.timeSig.length === 2) {
      score.timeSig = [Number(raw.timeSig[0]) || 4, Number(raw.timeSig[1]) || 4];
    }
    return score;
  }

  const score = raw as Score;
  for (const track of score.tracks) {
    track.id ||= newId("t");
    track.volume ??= 0.8;
    track.pan ??= 0;
    track.mute ??= false;
    track.solo ??= false;
    track.transpose ??= 0;
    track.visible ??= true;
    track.measures ??= [{ events: [] }];
  }
  normalizeMeasureCount(score);
  return score;
}
