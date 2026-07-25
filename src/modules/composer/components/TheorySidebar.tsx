"use client";

// Panel de teoría: detecta acordes/escalas de la selección actual y ofrece
// catálogos navegables por tónica con preview sonoro.

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { player } from "../audio/player";
import {
  chordCatalog,
  detectChords,
  detectScales,
  midiToName,
  nameToMidi,
  scaleCatalog,
} from "../model/theory";
import { useComposer } from "../state/composer-store";

const TONICS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

const selectClass =
  "h-8 rounded-md border border-input bg-transparent px-2 text-xs text-foreground focus:outline-none [&>option]:bg-popover";

export function TheorySidebar() {
  const score = useComposer((s) => s.score);
  const selection = useComposer((s) => s.selection);
  const activeTrackId = useComposer((s) => s.activeTrackId);

  const [view, setView] = useState("detect");
  const [tonic, setTonic] = useState("C");
  const [filter, setFilter] = useState("");

  const track = score.tracks.find(
    (t) => t.id === (selection?.trackId ?? activeTrackId)
  );

  // Notas bajo análisis: el evento seleccionado, o todo el compás
  const midis = useMemo(() => {
    if (!track || !selection) return [];
    const measure = track.measures[selection.measureIdx];
    if (!measure) return [];
    if (selection.eventId) {
      const ev = measure.events.find((e) => e.id === selection.eventId);
      return ev ? ev.pitches.map((p) => p.midi) : [];
    }
    return measure.events.flatMap((e) => e.pitches.map((p) => p.midi));
  }, [track, selection]);

  const chordMatches = useMemo(() => detectChords(midis), [midis]);
  const scaleMatches = useMemo(() => detectScales(midis), [midis]);

  const chords = useMemo(
    () =>
      chordCatalog(tonic).filter((c) =>
        c.symbol.toLowerCase().includes(filter.toLowerCase())
      ),
    [tonic, filter]
  );
  const scales = useMemo(
    () =>
      scaleCatalog(tonic).filter((s) =>
        s.name.toLowerCase().includes(filter.toLowerCase())
      ),
    [tonic, filter]
  );

  function preview(noteNames: string[], octave = 4) {
    if (!track) return;
    const notes = noteNames
      .map((n) => nameToMidi(`${n}${octave}`))
      .filter((m): m is number => m !== null);
    void player.preview(track, notes);
  }

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <Tabs value={view} onValueChange={setView}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="detect" className="text-xs">
            Detectar
          </TabsTrigger>
          <TabsTrigger value="chords" className="text-xs">
            Acordes
          </TabsTrigger>
          <TabsTrigger value="scales" className="text-xs">
            Escalas
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "detect" ? (
        <div className="flex-1 overflow-y-auto text-sm">
          {midis.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Selecciona una nota o un compás para analizar sus notas.
            </p>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted-foreground">
                Notas: {[...new Set(midis.map(midiToName))].join(", ")}
              </p>

              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Acordes más parecidos
              </h4>
              <ul className="mb-3 space-y-1">
                {chordMatches.map((c) => (
                  <li key={c.symbol} className="text-xs">
                    <div className="flex items-center gap-2">
                      <strong className="w-16 truncate">{c.symbol}</strong>
                      <span className="h-1.5 flex-1 overflow-hidden rounded bg-muted">
                        <span
                          className="block h-full rounded bg-blue-500"
                          style={{ width: `${c.score * 100}%` }}
                        />
                      </span>
                      <span className="w-9 text-right text-muted-foreground">
                        {Math.round(c.score * 100)}%
                      </span>
                    </div>
                    {c.missing.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        faltan: {c.missing.join(" ")}
                      </span>
                    )}
                  </li>
                ))}
                {chordMatches.length === 0 && (
                  <li className="text-xs text-muted-foreground">
                    Sin coincidencias claras.
                  </li>
                )}
              </ul>

              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Escalas que las contienen
              </h4>
              <ul className="space-y-1">
                {scaleMatches.map((s) => (
                  <li
                    key={`${s.tonic}${s.name}`}
                    className="flex justify-between text-xs"
                  >
                    <strong>
                      {s.tonic} {s.name}
                    </strong>
                    <span className="text-muted-foreground">
                      {Math.round(s.score * 100)}%
                    </span>
                  </li>
                ))}
                {scaleMatches.length === 0 && (
                  <li className="text-xs text-muted-foreground">Sin coincidencias.</li>
                )}
              </ul>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <select
              value={tonic}
              onChange={(e) => setTonic(e.target.value)}
              className={selectClass}
              aria-label="Tónica"
            >
              {TONICS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <Input
              placeholder="filtrar…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <ul className="flex-1 space-y-0.5 overflow-y-auto">
            {(view === "chords"
              ? chords.map((c) => ({ label: c.symbol, notes: c.notes }))
              : scales.map((s) => ({ label: `${tonic} ${s.name}`, notes: s.notes }))
            ).map(({ label, notes }) => (
              <li key={label}>
                <button
                  type="button"
                  title="Clic para escuchar"
                  onClick={() => preview(notes)}
                  className="w-full rounded px-1.5 py-1 text-left text-xs hover:bg-accent"
                >
                  <strong>{label}</strong>{" "}
                  <span className="text-muted-foreground">{notes.join(" ")}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
