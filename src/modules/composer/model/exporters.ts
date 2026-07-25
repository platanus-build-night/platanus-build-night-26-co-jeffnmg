// Exportadores: MIDI multitrack (.mid) y JSON del proyecto.

import { Midi } from "@tonejs/midi";

import {
  beatsPerMeasure,
  durationBeats,
  type Instrument,
  type Score,
  type Track,
} from "./score";
import { soundOption } from "./sounds";

const DRUM_CHANNEL = 9; // canal 10 GM (0-based)

function midiProgramFor(track: Track): number {
  if (track.instrument === "drums") return 0;
  return (
    soundOption(track.instrument as Exclude<Instrument, "drums">, track.sound)
      .midiProgram ?? 0
  );
}

export function scoreToMidi(score: Score): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(score.bpm);
  midi.header.timeSignatures.push({
    ticks: 0,
    timeSignature: [score.timeSig[0], score.timeSig[1]],
  });

  const secPerBeat = 60 / score.bpm;
  const measureBeats = beatsPerMeasure(score);

  score.tracks.forEach((track, trackIdx) => {
    const out = midi.addTrack();
    out.name = track.name;
    out.channel = track.instrument === "drums" ? DRUM_CHANNEL : trackIdx;
    out.instrument.number = midiProgramFor(track);

    track.measures.forEach((measure, measureIdx) => {
      for (const ev of measure.events) {
        if (ev.isRest) continue;
        const startSec = (measureIdx * measureBeats + ev.start) * secPerBeat;
        const durSec = durationBeats(ev.duration) * secPerBeat;
        const transpose = track.instrument === "drums" ? 0 : track.transpose;

        for (const pitch of ev.pitches) {
          out.addNote({
            midi: pitch.midi + transpose,
            time: startSec,
            duration: durSec,
            velocity: 0.85,
          });
        }
      }
    });
  });

  return midi.toArray();
}

export function exportProjectJson(score: Score): string {
  return JSON.stringify(score, null, 2);
}

/** Descarga un archivo en el navegador (solo cliente). */
export function downloadFile(
  data: Uint8Array | string,
  filename: string,
  mime: string
): void {
  const content =
    typeof data === "string" ? data : (data.slice().buffer as ArrayBuffer);
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
