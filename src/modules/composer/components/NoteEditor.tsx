"use client";

// Entrada de notas: figura activa (con puntillo), silencio, borrar, letra
// de la nota seleccionada, y piano en pantalla (o pads en batería).
// Clic = nota nueva · Ctrl+clic = suma/quita del acorde seleccionado.
// Delete/Backspace borra la selección (atajo global).

import { useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { player } from "../audio/player";
import { DRUM_NOTES, type DurationName } from "../model/score";
import { keyNotes, midiToName } from "../model/theory";
import { useComposer } from "../state/composer-store";

const DURATIONS: { name: DurationName; label: string; title: string }[] = [
  { name: "w", label: "𝅝", title: "Redonda" },
  { name: "h", label: "𝅗𝅥", title: "Blanca" },
  { name: "q", label: "𝅘𝅥", title: "Negra" },
  { name: "8", label: "𝅘𝅥𝅮", title: "Corchea" },
  { name: "16", label: "𝅘𝅥𝅯", title: "Semicorchea" },
];

const WHITE_SEMITONES = new Set([0, 2, 4, 5, 7, 9, 11]);

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function NoteEditor() {
  const score = useComposer((s) => s.score);
  const selection = useComposer((s) => s.selection);
  const activeTrackId = useComposer((s) => s.activeTrackId);
  const inputDuration = useComposer((s) => s.inputDuration);
  const setInputDuration = useComposer((s) => s.setInputDuration);
  const addNote = useComposer((s) => s.addNote);
  const toggleChordNote = useComposer((s) => s.toggleChordNote);
  const addRest = useComposer((s) => s.addRest);
  const deleteSelected = useComposer((s) => s.deleteSelected);
  const setLyric = useComposer((s) => s.setLyric);

  const track = score.tracks.find(
    (t) => t.id === (selection?.trackId ?? activeTrackId)
  );
  const inKey = useMemo(() => keyNotes(score.key), [score.key]);

  const selectedEvent = useMemo(() => {
    if (!selection?.eventId || !track) return null;
    return (
      track.measures[selection.measureIdx]?.events.find(
        (e) => e.id === selection.eventId
      ) ?? null
    );
  }, [selection, track]);

  // Atajo global: Delete/Backspace borra la nota seleccionada
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      deleteSelected();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelected]);

  if (!track) return null;

  function insert(midi: number, asChord: boolean) {
    if (asChord && selectedEvent) toggleChordNote(midi);
    else addNote(midi);
    if (track) void player.preview(track, [midi]);
  }

  const baseMidi = track.instrument === "bass" ? 36 : 48; // C2 bajo, C3 resto
  const octaves = track.instrument === "bass" ? 2 : 3;

  return (
    <div className="border-t border-border bg-card/60 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
          {DURATIONS.map((d) => (
            <Button
              key={d.name}
              size="sm"
              variant={inputDuration.name === d.name ? "secondary" : "ghost"}
              title={d.title}
              onClick={() =>
                setInputDuration({ name: d.name, dotted: inputDuration.dotted })
              }
              className="h-7 w-8 px-0 text-base"
            >
              {d.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant={inputDuration.dotted ? "secondary" : "ghost"}
            title="Puntillo"
            onClick={() =>
              setInputDuration({
                name: inputDuration.name,
                dotted: !inputDuration.dotted,
              })
            }
            className="h-7 w-8 px-0 text-base"
          >
            •
          </Button>
        </div>

        <Button size="sm" variant="outline" onClick={addRest}>
          Silencio
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!selectedEvent}
          onClick={deleteSelected}
          className="text-red-400 hover:text-red-300"
        >
          Borrar nota
        </Button>

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Letra
          <Input
            placeholder={selectedEvent ? "sílaba…" : "selecciona una nota"}
            disabled={!selectedEvent}
            value={selectedEvent?.lyric ?? ""}
            onChange={(e) => setLyric(e.target.value)}
            className="h-8 w-36 text-xs"
          />
        </label>

        <span className="ml-auto hidden text-[11px] text-muted-foreground lg:block">
          Clic = nota · Ctrl+clic = acorde · Space = play · Supr = borrar
        </span>
      </div>

      {track.instrument === "drums" ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DRUM_NOTES.map((d) => (
            <Button
              key={d.midi}
              size="sm"
              variant="secondary"
              onClick={(e) => insert(d.midi, e.ctrlKey)}
            >
              {d.label}
            </Button>
          ))}
        </div>
      ) : (
        <div className="mt-2 flex h-16 select-none overflow-x-auto pb-0.5">
          {Array.from({ length: octaves * 12 }, (_, i) => {
            const midi = baseMidi + i;
            const isWhite = WHITE_SEMITONES.has(midi % 12);
            const highlighted = inKey.has(midi % 12);
            return (
              <button
                key={midi}
                type="button"
                title={midiToName(midi)}
                onClick={(e) => insert(midi, e.ctrlKey)}
                className={`relative shrink-0 border border-border/70 transition-colors ${
                  isWhite
                    ? `w-7 ${highlighted ? "bg-slate-100" : "bg-slate-300/80"} hover:bg-blue-300`
                    : `w-5 ${highlighted ? "bg-slate-700" : "bg-slate-900"} hover:bg-blue-800`
                }`}
              >
                {midi % 12 === 0 && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-slate-800">
                    {midiToName(midi)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
