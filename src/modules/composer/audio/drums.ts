// Batería sintética propia: cada golpe es un AudioBuffer generado por
// código (one-shot vía BufferSource). Cuatro kits con carácter distinto.

export type DrumPad =
  | "kick"
  | "snare"
  | "hatClosed"
  | "hatOpen"
  | "crash"
  | "ride"
  | "tomMid"
  | "tomLow";

export type DrumKitId = "electronic" | "metal" | "room" | "punk";

/** Mapa GM percusión → pad del kit. */
const PAD_BY_MIDI: Record<number, DrumPad> = {
  36: "kick",
  38: "snare",
  42: "hatClosed",
  46: "hatOpen",
  49: "crash",
  51: "ride",
  45: "tomMid",
  41: "tomLow",
};

interface KitCharacter {
  kickFreq: number;
  kickDecay: number;
  kickClick: number;
  snareNoise: number;
  snareBody: number;
  snareDecay: number;
  hatBright: number;
  hatOpenDur: number;
  crashDur: number;
  tomHi: number;
  tomLo: number;
  gainBoost: number;
}

const KITS: Record<DrumKitId, KitCharacter> = {
  electronic: {
    kickFreq: 140,
    kickDecay: 5.5,
    kickClick: 0.15,
    snareNoise: 0.7,
    snareBody: 0.45,
    snareDecay: 14,
    hatBright: 0.95,
    hatOpenDur: 0.28,
    crashDur: 0.9,
    tomHi: 200,
    tomLo: 110,
    gainBoost: 1,
  },
  metal: {
    kickFreq: 110,
    kickDecay: 7.5,
    kickClick: 0.45,
    snareNoise: 0.95,
    snareBody: 0.25,
    snareDecay: 20,
    hatBright: 0.85,
    hatOpenDur: 0.2,
    crashDur: 1.4,
    tomHi: 240,
    tomLo: 130,
    gainBoost: 1.15,
  },
  room: {
    kickFreq: 95,
    kickDecay: 4.2,
    kickClick: 0.08,
    snareNoise: 0.55,
    snareBody: 0.55,
    snareDecay: 10,
    hatBright: 0.97,
    hatOpenDur: 0.35,
    crashDur: 1.1,
    tomHi: 180,
    tomLo: 95,
    gainBoost: 0.95,
  },
  punk: {
    kickFreq: 130,
    kickDecay: 9,
    kickClick: 0.35,
    snareNoise: 1,
    snareBody: 0.2,
    snareDecay: 24,
    hatBright: 0.88,
    hatOpenDur: 0.15,
    crashDur: 0.7,
    tomHi: 220,
    tomLo: 120,
    gainBoost: 1.2,
  },
};

/** PRNG determinista para que el ruido de los kits sea reproducible. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function emptyBuffer(sr: number, seconds: number): AudioBuffer {
  return new AudioBuffer({
    length: Math.floor(sr * seconds),
    numberOfChannels: 1,
    sampleRate: sr,
  });
}

function synthKick(sr: number, k: KitCharacter): AudioBuffer {
  const buf = emptyBuffer(sr, 0.5);
  const data = buf.getChannelData(0);
  const rnd = seededRandom(1);
  let phase = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const freq = k.kickFreq * Math.exp(-18 * t) + 35; // pitch drop
    phase += (2 * Math.PI * freq) / sr;
    const body = Math.sin(phase) * Math.exp(-k.kickDecay * t);
    const click = (rnd() * 2 - 1) * Math.exp(-90 * t) * k.kickClick;
    data[i] = body + click;
  }
  return buf;
}

function synthSnare(sr: number, k: KitCharacter): AudioBuffer {
  const buf = emptyBuffer(sr, 0.25);
  const data = buf.getChannelData(0);
  const rnd = seededRandom(42);
  let phase = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const noise = (rnd() * 2 - 1) * Math.exp(-k.snareDecay * t) * k.snareNoise;
    phase += (2 * Math.PI * 190 * Math.exp(-12 * t)) / sr;
    const body = Math.sin(phase) * Math.exp(-(k.snareDecay + 4) * t) * k.snareBody;
    data[i] = noise + body;
  }
  return buf;
}

function synthHat(sr: number, open: boolean, k: KitCharacter): AudioBuffer {
  const buf = emptyBuffer(sr, open ? k.hatOpenDur : 0.05);
  const data = buf.getChannelData(0);
  const rnd = seededRandom(open ? 99 : 7);
  let prev = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const white = rnd() * 2 - 1;
    // filtro paso-alto de un polo para el brillo metálico
    const highpassed = white - prev;
    prev = white * k.hatBright;
    data[i] = highpassed * Math.exp(-(open ? 9 : 60) * t) * 0.5;
  }
  return buf;
}

function synthCymbal(sr: number, long: boolean, k: KitCharacter): AudioBuffer {
  const buf = emptyBuffer(sr, long ? k.crashDur : k.crashDur * 0.45);
  const data = buf.getChannelData(0);
  const rnd = seededRandom(long ? 123 : 321);
  let prev = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const white = rnd() * 2 - 1;
    const highpassed = white - prev;
    prev = white * 0.88;
    data[i] = highpassed * Math.exp(-(long ? 2.8 : 6.5) * t) * 0.42;
  }
  return buf;
}

function synthTom(sr: number, freq: number): AudioBuffer {
  const buf = emptyBuffer(sr, 0.35);
  const data = buf.getChannelData(0);
  let phase = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    phase += (2 * Math.PI * freq * Math.exp(-6 * t)) / sr;
    data[i] = Math.sin(phase) * Math.exp(-7 * t) * 0.85;
  }
  return buf;
}

type KitBuffers = Record<DrumPad, AudioBuffer>;

function synthesizeKit(sr: number, id: DrumKitId): KitBuffers {
  const k = KITS[id];
  return {
    kick: synthKick(sr, k),
    snare: synthSnare(sr, k),
    hatClosed: synthHat(sr, false, k),
    hatOpen: synthHat(sr, true, k),
    crash: synthCymbal(sr, true, k),
    ride: synthCymbal(sr, false, k),
    tomMid: synthTom(sr, k.tomHi),
    tomLow: synthTom(sr, k.tomLo),
  };
}

function toKitId(id?: string): DrumKitId {
  return id === "metal" || id === "room" || id === "punk" ? id : "electronic";
}

export class DrumEngine {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private kits = new Map<DrumKitId, KitBuffers>();
  private activeKit: DrumKitId = "electronic";
  private volume = 0.85;

  /** Prepara (o re-prepara si cambió el contexto) el kit indicado. */
  ensure(ctx: AudioContext, kitId?: string): void {
    const id = toKitId(kitId);
    if (this.ctx !== ctx || !this.out) {
      this.ctx = ctx;
      this.out = ctx.createGain();
      this.out.gain.value = this.volume;
      this.out.connect(ctx.destination);
      this.kits.clear();
    }
    if (!this.kits.has(id)) {
      this.kits.set(id, synthesizeKit(ctx.sampleRate, id));
    }
    this.activeKit = id;
  }

  setKit(kitId?: string): void {
    if (this.ctx) this.ensure(this.ctx, kitId);
  }

  setVolume(linear: number): void {
    this.volume = Math.min(1, Math.max(0, linear));
    if (this.out) this.out.gain.value = this.volume;
  }

  triggerMidi(midi: number, time?: number, velocity = 0.9, kitId?: string): void {
    if (kitId) this.setKit(kitId);
    this.trigger(PAD_BY_MIDI[midi] ?? "snare", time, velocity);
  }

  trigger(pad: DrumPad, time?: number, velocity = 0.9): void {
    if (!this.ctx || !this.out) return;
    const buffers = this.kits.get(this.activeKit);
    if (!buffers) return;

    const ctx = this.ctx;
    const boost = KITS[this.activeKit].gainBoost;
    const level = Math.min(1, Math.max(0.05, velocity)) * this.volume * boost;

    const source = ctx.createBufferSource();
    source.buffer = buffers[pad];
    const gain = ctx.createGain();
    gain.gain.value = Math.min(1.5, level);
    source.connect(gain);
    gain.connect(this.out);
    source.start(Math.max(time ?? ctx.currentTime, ctx.currentTime));
    source.onended = () => {
      try {
        source.disconnect();
        gain.disconnect();
      } catch {
        // ya desconectado
      }
    };
  }
}

let sharedEngine: DrumEngine | null = null;

export function getDrumEngine(): DrumEngine {
  if (!sharedEngine) sharedEngine = new DrumEngine();
  return sharedEngine;
}
