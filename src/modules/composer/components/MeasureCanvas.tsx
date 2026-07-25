"use client";

// Un compás de una pista dibujado con VexFlow: pentagrama siempre y
// tablatura debajo en guitarra/bajo. VexFlow asume fondo blanco, así que
// tras dibujar se retocan los SVG para que la tab se lea en tema oscuro.

import { useEffect, useRef } from "react";
import { Midi } from "tonal";
import {
  Annotation,
  AnnotationVerticalJustify,
  Beam,
  Dot,
  Formatter,
  GhostNote,
  Renderer,
  Stave,
  StaveNote,
  TabNote,
  TabStave,
  Voice,
} from "vexflow";

import type { Measure, Score, ScoreEvent, Track } from "../model/score";

export const MEASURE_WIDTH = 260;
export const STAFF_ROW_HEIGHT = 150;
export const TAB_ROW_HEIGHT = 260;

const INK = "#e8eaf2";
const TAB_BG = "#12141c";
const ACCENT = "#4f8cff";

/** MIDI → clave VexFlow, ej. 61 → "c#/4". */
function staffKey(midi: number): string {
  const match = Midi.midiToNoteName(midi).match(/^([A-G])(#{0,2}|b{0,2})(-?\d+)$/);
  return match ? `${match[1].toLowerCase()}${match[2]}/${match[3]}` : "c/4";
}

/** Posición en pentagrama de percusión para cada pad GM (x = cabeza en cruz). */
const DRUM_STAFF_POS: Record<number, { key: string; cross: boolean }> = {
  36: { key: "f/4", cross: false }, // bombo
  38: { key: "c/5", cross: false }, // redoblante
  41: { key: "a/4", cross: false }, // tom piso
  45: { key: "b/4", cross: false }, // tom medio
  42: { key: "g/5", cross: true }, // hi-hat cerrado
  46: { key: "g/5", cross: true }, // hi-hat abierto
  49: { key: "a/5", cross: true }, // crash
  51: { key: "f/5", cross: true }, // ride
};

function drumStaffKey(midi: number): string {
  const pos = DRUM_STAFF_POS[midi] ?? { key: "c/5", cross: true };
  return pos.cross ? `${pos.key}/x2` : pos.key;
}

function vexDuration(ev: ScoreEvent): string {
  return ev.isRest ? `${ev.duration.name}r` : ev.duration.name;
}

/**
 * VexFlow pinta rectángulos blancos detrás de los números de traste.
 * En tema oscuro los reemplazamos por el fondo del canvas y forzamos
 * la tinta clara en los números.
 */
function fixDarkThemeContrast(container: HTMLElement): void {
  const svg = container.querySelector("svg");
  if (!svg) return;

  svg.querySelectorAll("rect").forEach((rect) => {
    const attrFill = (rect.getAttribute("fill") ?? "").toLowerCase();
    const styleFill = (rect as SVGRectElement).style.fill?.toLowerCase() ?? "";
    const whiteish = ["#fff", "#ffffff", "white", "rgb(255, 255, 255)"];
    const width = Number(rect.getAttribute("width") ?? 0);
    const height = Number(rect.getAttribute("height") ?? 0);
    const isSmallBox = width > 0 && width < 30 && height > 0 && height < 30;
    if (whiteish.includes(attrFill) || whiteish.includes(styleFill) || isSmallBox) {
      rect.setAttribute("fill", TAB_BG);
      (rect as SVGRectElement).style.fill = TAB_BG;
    }
  });

  svg.querySelectorAll("text").forEach((text) => {
    const content = (text.textContent ?? "").trim();
    if (/^(\d{1,2}|x|X)$/.test(content)) {
      text.setAttribute("fill", INK);
      (text as SVGTextElement).style.fill = INK;
      if (text.getAttribute("stroke")) {
        text.setAttribute("stroke", INK);
        (text as SVGTextElement).style.stroke = INK;
      }
    }
  });
}

interface NoteHit {
  eventId: string;
  x: number;
}

interface MeasureCanvasProps {
  score: Score;
  track: Track;
  measure: Measure;
  isFirst: boolean;
  selectedEventId: string | null;
  onSelectEvent: (eventId: string | null) => void;
}

export function MeasureCanvas({
  score,
  track,
  measure,
  isFirst,
  selectedEventId,
  onSelectEvent,
}: MeasureCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hitsRef = useRef<NoteHit[]>([]);

  const hasTab =
    (track.instrument === "guitar" || track.instrument === "bass") &&
    !!track.tuning;
  const height = hasTab ? TAB_ROW_HEIGHT : STAFF_ROW_HEIGHT;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = "";
    hitsRef.current = [];

    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(MEASURE_WIDTH, height);
    const ctx = renderer.getContext();
    ctx.setFillStyle(INK);
    ctx.setStrokeStyle(INK);

    const clef =
      track.instrument === "bass"
        ? "bass"
        : track.instrument === "drums"
          ? "percussion"
          : "treble";

    const stave = new Stave(0, 10, MEASURE_WIDTH - 2);
    if (isFirst) {
      stave
        .addClef(clef)
        .addTimeSignature(`${score.timeSig[0]}/${score.timeSig[1]}`);
      if (track.instrument !== "drums") {
        const [tonic] = score.key.split(" ");
        stave.addKeySignature(score.key.includes("minor") ? `${tonic}m` : tonic);
      }
    }
    stave.setContext(ctx).draw();

    const ordered = [...measure.events].sort((a, b) => a.start - b.start);
    const formatWidth = MEASURE_WIDTH - (isFirst ? 90 : 30);

    const staffNotes = ordered.map((ev) => {
      if (ev.isRest) {
        return new StaveNote({ keys: ["b/4"], duration: vexDuration(ev), clef });
      }
      const keys =
        track.instrument === "drums"
          ? ev.pitches.map((p) => drumStaffKey(p.midi))
          : ev.pitches.map((p) => staffKey(p.midi));
      const note = new StaveNote({ keys, duration: ev.duration.name, clef });
      if (ev.duration.dotted) Dot.buildAndAttach([note], { all: true });
      if (ev.lyric) {
        note.addModifier(
          new Annotation(ev.lyric)
            .setFont("sans-serif", 11)
            .setVerticalJustification(AnnotationVerticalJustify.BOTTOM)
        );
      }
      if (ev.id === selectedEventId) {
        note.setStyle({ fillStyle: ACCENT, strokeStyle: ACCENT });
      }
      return note;
    });

    if (staffNotes.length > 0) {
      const voice = new Voice({
        num_beats: score.timeSig[0],
        beat_value: score.timeSig[1],
      });
      voice.setStrict(false);
      voice.addTickables(staffNotes);
      const beams = Beam.generateBeams(staffNotes.filter((n) => !n.isRest()));
      new Formatter().joinVoices([voice]).format([voice], formatWidth);
      voice.draw(ctx, stave);
      beams.forEach((b) => b.setContext(ctx).draw());

      ordered.forEach((ev, i) => {
        hitsRef.current.push({ eventId: ev.id, x: staffNotes[i].getAbsoluteX() });
      });
    }

    if (hasTab && track.tuning) {
      const tabStave = new TabStave(0, STAFF_ROW_HEIGHT - 10, MEASURE_WIDTH - 2, {
        num_lines: track.tuning.length,
      });
      if (isFirst) tabStave.addClef("tab");
      tabStave.setContext(ctx).draw();

      const tabNotes = ordered.map((ev) => {
        if (ev.isRest || ev.pitches.some((p) => p.string === undefined)) {
          return new GhostNote(vexDuration(ev));
        }
        const tabNote = new TabNote({
          positions: ev.pitches.map((p) => ({ str: p.string!, fret: p.fret! })),
          duration: ev.duration.name,
        });
        const color = ev.id === selectedEventId ? ACCENT : INK;
        tabNote.setStyle({ fillStyle: color, strokeStyle: color });
        return tabNote;
      });

      if (tabNotes.length > 0) {
        const tabVoice = new Voice({
          num_beats: score.timeSig[0],
          beat_value: score.timeSig[1],
        });
        tabVoice.setStrict(false);
        tabVoice.addTickables(tabNotes);
        new Formatter().joinVoices([tabVoice]).format([tabVoice], formatWidth);
        tabVoice.draw(ctx, tabStave);
      }
    }

    fixDarkThemeContrast(el);
  }, [score, track, measure, isFirst, selectedEventId, hasTab, height]);

  /** Selecciona la nota más cercana al click (o deselecciona). */
  function handleClick(e: React.MouseEvent) {
    const rect = containerRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let best: NoteHit | null = null;
    let bestDist = 28;
    for (const hit of hitsRef.current) {
      const dist = Math.abs(hit.x - x);
      if (dist < bestDist) {
        bestDist = dist;
        best = hit;
      }
    }
    onSelectEvent(best?.eventId ?? null);
  }

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{ width: MEASURE_WIDTH, height }}
      className="shrink-0 cursor-pointer"
    />
  );
}
