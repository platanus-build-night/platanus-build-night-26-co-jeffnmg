// Reproductor multitrack de baja latencia sobre Tone.js + smplr.
// Claves de diseño:
// - El playhead lee Tone.Transport.seconds: mismo reloj que dispara las
//   notas, así el cursor visual nunca se desfasa del audio.
// - lookAhead de 40ms (el default de ~100ms se siente atrasado al dar play).
// - Batería propia one-shot (drums.ts); melódicos por soundfont GM (smplr)
//   con caché por "instrument:sound" y synth de respaldo si falla la red.

import * as Tone from "tone";
import { SplendidGrandPiano, Soundfont } from "smplr";

import {
  beatsPerMeasure,
  durationBeats,
  totalMeasures,
  type Instrument,
  type Score,
  type Track,
} from "../model/score";
import { defaultSound, soundOption } from "../model/sounds";
import { getDrumEngine } from "./drums";

export interface PlayheadPos {
  measureIdx: number;
  beat: number;
}

/** Superficie mínima que usamos de los instrumentos de smplr. */
interface Sampled {
  start: (opts: {
    note: string | number;
    time?: number;
    duration?: number;
    velocity?: number;
  }) => void;
  stop: () => void;
  load: Promise<unknown>;
  output?: { setVolume: (v: number) => void };
}

const LOOK_AHEAD_SEC = 0.04;
const STRUM_DELAY_SEC = 0.012; // rasgueo sutil en acordes de guitarra

function rawContext(): AudioContext {
  return Tone.getContext().rawContext as AudioContext;
}

function lowLatency(): void {
  Tone.getContext().lookAhead = LOOK_AHEAD_SEC;
}

function cacheKey(t: Pick<Track, "instrument" | "sound">): string {
  return `${t.instrument}:${t.sound ?? defaultSound(t.instrument)}`;
}

const sampleCache = new Map<string, Promise<Sampled | null>>();

async function loadSampled(
  t: Pick<Track, "instrument" | "sound">
): Promise<Sampled | null> {
  if (t.instrument === "drums") return null;

  const key = cacheKey(t);
  let cached = sampleCache.get(key);
  if (!cached) {
    cached = (async () => {
      try {
        const ctx = rawContext();
        const opt = soundOption(t.instrument, t.sound);
        const useGrandPiano =
          t.instrument === "piano" && (t.sound ?? "grand") === "grand";

        const inst = (
          useGrandPiano || !opt.soundfont
            ? new SplendidGrandPiano(ctx)
            : new Soundfont(ctx, { instrument: opt.soundfont })
        ) as unknown as Sampled;

        await inst.load;
        return inst;
      } catch (err) {
        console.warn(`[player] samples no disponibles (${key})`, err);
        sampleCache.delete(key);
        return null;
      }
    })();
    sampleCache.set(key, cached);
  }
  return cached;
}

/** Synth de respaldo por si el soundfont no carga (p. ej. sin red). */
function fallbackSynth(instrument: Instrument): Tone.PolySynth {
  if (instrument === "guitar") {
    return new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 2,
      envelope: { attack: 0.004, decay: 0.5, sustain: 0.1, release: 0.8 },
    });
  }
  if (instrument === "bass") {
    return new Tone.PolySynth(Tone.MonoSynth, {
      oscillator: { type: "square" },
      filter: { frequency: 700, type: "lowpass" },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.5 },
    } as never);
  }
  if (instrument === "piano") {
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle8" },
      envelope: { attack: 0.005, decay: 0.6, sustain: 0.2, release: 1.2 },
    });
  }
  return new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 0.06, decay: 0.2, sustain: 0.7, release: 0.6 },
  });
}

interface ActiveTrack {
  sampled: Sampled | null;
  synth?: Tone.PolySynth;
  channel: Tone.Channel;
  gainLevel: number;
  muted: boolean;
  isDrums: boolean;
  drumKit?: string;
}

export interface StartOptions {
  /** 1 = velocidad normal. */
  speed: number;
  /** Rango de compases [desde, hasta] inclusive, o null. */
  loop: [number, number] | null;
  /** Compás desde el que arrancar (si no hay loop). */
  startMeasure?: number;
  onStop: () => void;
}

export class Player {
  private active = new Map<string, ActiveTrack>();
  private master: Tone.Compressor | null = null;
  private playing = false;
  private secPerBeat = 0.6;
  private measureBeats = 4;
  private endSec = 0;
  private looping = false;

  private masterBus(): Tone.Compressor {
    if (!this.master) {
      this.master = new Tone.Compressor({
        threshold: -18,
        ratio: 3,
        attack: 0.01,
        release: 0.2,
      }).toDestination();
    }
    return this.master;
  }

  /** Llamar en el primer gesto del usuario: desbloquea audio y carga samples. */
  preload(tracks: Pick<Track, "instrument" | "sound">[]): void {
    void Tone.start().then(() => {
      lowLatency();
      const drums = getDrumEngine();
      for (const t of tracks) {
        if (t.instrument === "drums") drums.ensure(rawContext(), t.sound);
        else void loadSampled(t);
      }
      drums.ensure(rawContext(), "electronic");
    });
  }

  isPlaying(): boolean {
    return this.playing;
  }

  /** Posición actual del cursor, o null si está detenido. */
  getPlayhead(): PlayheadPos | null {
    if (!this.playing) return null;
    const transport = Tone.getTransport();
    if (transport.state !== "started") return null;

    let sec = transport.seconds;
    if (!this.looping && sec >= this.endSec) {
      sec = Math.max(0, this.endSec - 1e-4);
    }
    const absBeat = sec / this.secPerBeat;
    const measureIdx = Math.floor(absBeat / this.measureBeats);
    return { measureIdx, beat: absBeat - measureIdx * this.measureBeats };
  }

  private async prepareTrack(track: Track, muted: boolean): Promise<ActiveTrack> {
    const channel = new Tone.Channel({
      volume: Tone.gainToDb(track.volume),
      pan: track.pan,
      mute: muted,
    }).connect(this.masterBus());

    if (track.instrument === "drums") {
      const drums = getDrumEngine();
      const kit = track.sound ?? "electronic";
      drums.ensure(rawContext(), kit);
      drums.setVolume(track.volume);
      return {
        sampled: null,
        channel,
        gainLevel: track.volume,
        muted,
        isDrums: true,
        drumKit: kit,
      };
    }

    const sampled = await loadSampled(track);
    if (sampled?.output) {
      try {
        sampled.output.setVolume(Math.round(track.volume * 100));
      } catch {
        // API opcional según instrumento
      }
    }

    const at: ActiveTrack = {
      sampled,
      channel,
      gainLevel: track.volume,
      muted,
      isDrums: false,
    };
    if (!sampled) at.synth = fallbackSynth(track.instrument).connect(channel);
    return at;
  }

  private fire(
    at: ActiveTrack,
    track: Track,
    midis: number[],
    time: number,
    durSec: number
  ): void {
    if (at.muted) return;
    const vel = Math.min(1, Math.max(0.05, at.gainLevel));

    if (at.isDrums) {
      const drums = getDrumEngine();
      for (const midi of midis) drums.triggerMidi(midi, time, vel, at.drumKit);
      return;
    }

    const midiVel = Math.round(95 * vel);
    const strum = track.instrument === "guitar" && midis.length > 2;

    midis.forEach((midi, i) => {
      const note = midi + track.transpose;
      const when = time + (strum ? i * STRUM_DELAY_SEC : 0);
      if (at.sampled) {
        at.sampled.start({
          note,
          time: when,
          duration: durSec,
          velocity: midiVel,
        });
      } else {
        at.synth?.triggerAttackRelease(
          Tone.Frequency(note, "midi").toNote(),
          durSec,
          when,
          vel
        );
      }
    });
  }

  async start(score: Score, opts: StartOptions): Promise<void> {
    await Tone.start();
    lowLatency();
    this.stop();

    const transport = Tone.getTransport();
    transport.bpm.value = score.bpm * opts.speed;
    transport.timeSignature = score.timeSig;

    this.measureBeats = beatsPerMeasure(score);
    this.secPerBeat = 60 / (score.bpm * opts.speed);

    const anySolo = score.tracks.some((t) => t.solo);
    await Promise.all(
      score.tracks.map(async (track) => {
        const muted = track.mute || (anySolo && !track.solo);
        this.active.set(track.id, await this.prepareTrack(track, muted));
      })
    );

    // Programar todos los eventos en el Transport
    for (const track of score.tracks) {
      const at = this.active.get(track.id)!;
      track.measures.forEach((measure, mi) => {
        for (const ev of measure.events) {
          if (ev.isRest || ev.pitches.length === 0) continue;
          const startSec = (mi * this.measureBeats + ev.start) * this.secPerBeat;
          const durSec = durationBeats(ev.duration) * this.secPerBeat;
          const midis = ev.pitches.map((p) => p.midi);
          transport.schedule((time) => {
            this.fire(at, track, midis, time, durSec);
          }, startSec);
        }
      });
    }

    this.endSec = totalMeasures(score) * this.measureBeats * this.secPerBeat;

    if (opts.loop) {
      const [from, to] = opts.loop;
      this.looping = true;
      transport.setLoopPoints(
        from * this.measureBeats * this.secPerBeat,
        (to + 1) * this.measureBeats * this.secPerBeat
      );
      transport.loop = true;
    } else {
      this.looping = false;
      transport.loop = false;
      transport.schedule(() => {
        this.stop();
        opts.onStop();
      }, this.endSec);
    }

    const startMeasure = opts.loop ? opts.loop[0] : (opts.startMeasure ?? 0);
    this.playing = true;
    transport.start("+0", startMeasure * this.measureBeats * this.secPerBeat);
  }

  stop(): void {
    this.playing = false;
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    transport.loop = false;

    for (const at of this.active.values()) {
      try {
        at.sampled?.stop();
      } catch {
        // el instrumento puede no haber cargado
      }
      at.synth?.dispose();
      at.channel.dispose();
    }
    this.active.clear();
  }

  /** Suena un puñado de notas sueltas (previews del editor / teoría). */
  async preview(track: Track, midis: number[]): Promise<void> {
    await Tone.start();
    lowLatency();

    if (track.instrument === "drums") {
      const drums = getDrumEngine();
      drums.ensure(rawContext(), track.sound);
      drums.setVolume(track.volume);
      for (const midi of midis) {
        drums.triggerMidi(midi, undefined, track.volume, track.sound);
      }
      return;
    }

    const sampled = await loadSampled(track);
    if (sampled) {
      const vel = Math.round(95 * track.volume);
      for (const midi of midis) {
        sampled.start({ note: midi + track.transpose, duration: 0.8, velocity: vel });
      }
      return;
    }

    const synth = fallbackSynth(track.instrument).toDestination();
    synth.volume.value = Tone.gainToDb(track.volume);
    synth.triggerAttackRelease(
      midis.map((m) => Tone.Frequency(m + track.transpose, "midi").toNote()),
      0.6
    );
    setTimeout(() => synth.dispose(), 2000);
  }
}

/** Instancia compartida de toda la app. */
export const player = new Player();
