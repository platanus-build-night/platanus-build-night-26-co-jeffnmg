// Catálogo de variantes de sonido por instrumento.
// Track.sound guarda el id; el reproductor resuelve el soundfont GM
// y el exportador MIDI el número de programa.

import type { Instrument } from "./score";

export interface SoundOption {
  id: string;
  label: string;
  /** Nombre de soundfont GM para smplr (si aplica). */
  soundfont?: string;
  /** Número de programa GM al exportar MIDI. */
  midiProgram?: number;
}

export const SOUND_OPTIONS: Record<Instrument, SoundOption[]> = {
  guitar: [
    { id: "acoustic", label: "Acústica", soundfont: "acoustic_guitar_steel", midiProgram: 25 },
    { id: "nylon", label: "Acústica nylon", soundfont: "acoustic_guitar_nylon", midiProgram: 24 },
    { id: "clean", label: "Eléctrica limpia", soundfont: "electric_guitar_clean", midiProgram: 27 },
    { id: "overdrive", label: "Eléctrica overdrive", soundfont: "overdriven_guitar", midiProgram: 29 },
    { id: "distortion", label: "Eléctrica distorsión", soundfont: "distortion_guitar", midiProgram: 30 },
    { id: "muted", label: "Eléctrica muteada", soundfont: "electric_guitar_muted", midiProgram: 28 },
  ],
  bass: [
    { id: "finger", label: "Finger", soundfont: "electric_bass_finger", midiProgram: 33 },
    { id: "pick", label: "Púa", soundfont: "electric_bass_pick", midiProgram: 34 },
    { id: "slap", label: "Slap", soundfont: "slap_bass_1", midiProgram: 36 },
    { id: "fretless", label: "Fretless", soundfont: "fretless_bass", midiProgram: 35 },
    { id: "acoustic", label: "Acústico", soundfont: "acoustic_bass", midiProgram: 32 },
  ],
  piano: [
    { id: "grand", label: "Piano de cola", midiProgram: 0 },
    { id: "electric", label: "Piano eléctrico", soundfont: "electric_piano_1", midiProgram: 4 },
    { id: "honky", label: "Honky-tonk", soundfont: "honkytonk_piano", midiProgram: 3 },
    { id: "clavinet", label: "Clavinet", soundfont: "clavinet", midiProgram: 7 },
  ],
  voice: [
    { id: "choir", label: "Coro (aah)", soundfont: "choir_aahs", midiProgram: 52 },
    { id: "oohs", label: "Coro (ooh)", soundfont: "voice_oohs", midiProgram: 53 },
    { id: "synth", label: "Coro synth", soundfont: "synth_choir", midiProgram: 54 },
  ],
  // La batería es sintética propia (drums.ts); no usa soundfont.
  drums: [
    { id: "electronic", label: "Electrónica (808)" },
    { id: "metal", label: "Metal / rock" },
    { id: "room", label: "Acústica (sala)" },
    { id: "punk", label: "Punk / garage" },
  ],
};

export function defaultSound(instrument: Instrument): string {
  return SOUND_OPTIONS[instrument][0].id;
}

export function soundOption(instrument: Instrument, soundId?: string): SoundOption {
  const options = SOUND_OPTIONS[instrument];
  return options.find((o) => o.id === soundId) ?? options[0];
}

export function soundLabel(instrument: Instrument, soundId?: string): string {
  return soundOption(instrument, soundId).label;
}
