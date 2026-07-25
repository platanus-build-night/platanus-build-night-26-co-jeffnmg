"use client";

// Columna izquierda estilo DAW: pistas con renombre, mute/solo/visibilidad,
// volumen/pan, variante de sonido, transposición y capo; agregar/quitar
// pistas y compases, y toggle multipista.

import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { player } from "../audio/player";
import type { Instrument } from "../model/score";
import { SOUND_OPTIONS, defaultSound } from "../model/sounds";
import { useComposer } from "../state/composer-store";

const INSTRUMENTS: { id: Instrument; label: string; icon: string }[] = [
  { id: "guitar", label: "Guitarra", icon: "🎸" },
  { id: "bass", label: "Bajo", icon: "🎸" },
  { id: "piano", label: "Piano", icon: "🎹" },
  { id: "drums", label: "Batería", icon: "🥁" },
  { id: "voice", label: "Voz", icon: "🎤" },
];

const selectClass =
  "h-7 w-full rounded border border-input bg-transparent px-1.5 text-[11px] text-foreground focus:outline-none [&>option]:bg-popover";

export function TrackMixer() {
  const score = useComposer((s) => s.score);
  const updateScore = useComposer((s) => s.updateScore);
  const addTrack = useComposer((s) => s.addTrack);
  const removeTrack = useComposer((s) => s.removeTrack);
  const transposeTrack = useComposer((s) => s.transposeTrack);
  const multitrack = useComposer((s) => s.multitrack);
  const setMultitrack = useComposer((s) => s.setMultitrack);
  const addMeasure = useComposer((s) => s.addMeasure);
  const activeTrackId = useComposer((s) => s.activeTrackId);
  const setActiveTrack = useComposer((s) => s.setActiveTrack);

  function patchTrack(trackId: string, patch: (t: (typeof score.tracks)[number]) => void) {
    updateScore((s) => {
      const track = s.tracks.find((t) => t.id === trackId);
      if (track) patch(track);
    });
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pistas
        </span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={multitrack ? "secondary" : "ghost"}
            onClick={() => setMultitrack(!multitrack)}
            className="h-6 px-2 text-[10px]"
            title="Ver todas las pistas o solo la activa"
          >
            {multitrack ? "Multi" : "Única"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={addMeasure}
            className="h-6 px-2 text-[10px]"
            title="Agregar compás al final"
          >
            <Plus className="size-3" /> Compás
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-x-hidden overflow-y-auto">
        {score.tracks.map((t) => (
          <div
            key={t.id}
            onClick={() => setActiveTrack(t.id)}
            className={`cursor-pointer space-y-1.5 border-b border-border/60 px-3 py-2 ${
              t.id === activeTrackId ? "bg-blue-500/10" : "hover:bg-accent/40"
            }`}
          >
            <div className="flex items-center gap-1">
              <input
                value={t.name}
                onChange={(e) =>
                  patchTrack(t.id, (tr) => {
                    tr.name = e.target.value;
                  })
                }
                className="h-6 w-0 flex-1 overflow-hidden rounded border border-transparent bg-transparent px-1 text-xs font-medium text-ellipsis focus:border-input focus:outline-none"
                aria-label="Nombre de pista"
                title={t.name}
              />
              <button
                type="button"
                title="Silenciar"
                onClick={(e) => {
                  e.stopPropagation();
                  patchTrack(t.id, (tr) => {
                    tr.mute = !tr.mute;
                  });
                }}
                className={`h-5 w-5 shrink-0 rounded text-[10px] font-bold ${
                  t.mute ? "bg-red-500/80 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                M
              </button>
              <button
                type="button"
                title="Solo"
                onClick={(e) => {
                  e.stopPropagation();
                  patchTrack(t.id, (tr) => {
                    tr.solo = !tr.solo;
                  });
                }}
                className={`h-5 w-5 shrink-0 rounded text-[10px] font-bold ${
                  t.solo ? "bg-amber-500/90 text-black" : "bg-muted text-muted-foreground"
                }`}
              >
                S
              </button>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              Vol
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={t.volume}
                onChange={(e) =>
                  patchTrack(t.id, (tr) => {
                    tr.volume = Number(e.target.value);
                  })
                }
                className="h-1 flex-1 accent-blue-500"
              />
              Pan
              <input
                type="range"
                min={-1}
                max={1}
                step={0.1}
                value={t.pan}
                onChange={(e) =>
                  patchTrack(t.id, (tr) => {
                    tr.pan = Number(e.target.value);
                  })
                }
                className="h-1 flex-1 accent-blue-500"
              />
            </div>

            <select
              value={t.sound ?? defaultSound(t.instrument)}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                const sound = e.target.value;
                patchTrack(t.id, (tr) => {
                  tr.sound = sound;
                });
                const previewMidi =
                  t.instrument === "drums" ? 36 : t.instrument === "bass" ? 40 : 60;
                void player.preview({ ...t, sound }, [previewMidi]);
              }}
              className={selectClass}
              aria-label="Variante de sonido"
            >
              {SOUND_OPTIONS[t.instrument].map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
              {t.instrument !== "drums" && (
                <>
                  Transp.
                  {[
                    { label: "-1", semis: -1 },
                    { label: "+1", semis: 1 },
                    { label: "-8ª", semis: -12 },
                    { label: "+8ª", semis: 12 },
                  ].map((b) => (
                    <button
                      key={b.label}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        transposeTrack(t.id, b.semis);
                      }}
                      className="rounded bg-muted px-1 py-0.5 hover:bg-accent"
                    >
                      {b.label}
                    </button>
                  ))}
                  {t.tuning && (
                    <label className="flex items-center gap-1">
                      Capo
                      <input
                        type="number"
                        min={0}
                        max={9}
                        value={t.capo ?? 0}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          patchTrack(t.id, (tr) => {
                            tr.capo = Number(e.target.value) || 0;
                          })
                        }
                        className="h-5 w-8 rounded border border-input bg-transparent px-1 text-[10px] focus:outline-none"
                      />
                    </label>
                  )}
                </>
              )}
              <span className="ml-auto flex gap-1">
                <button
                  type="button"
                  title="Mostrar/ocultar en multipista"
                  onClick={(e) => {
                    e.stopPropagation();
                    patchTrack(t.id, (tr) => {
                      tr.visible = !tr.visible;
                    });
                  }}
                  className="grid h-5 w-5 place-items-center rounded bg-muted text-muted-foreground hover:bg-accent"
                >
                  {t.visible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                </button>
                <button
                  type="button"
                  title="Eliminar pista"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTrack(t.id);
                  }}
                  className="grid h-5 w-5 place-items-center rounded bg-muted text-muted-foreground hover:bg-red-500/80 hover:text-white"
                >
                  <Trash2 className="size-3" />
                </button>
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1 border-t border-border p-2">
        {INSTRUMENTS.map((i) => (
          <Button
            key={i.id}
            size="sm"
            variant="outline"
            onClick={() => addTrack(i.id)}
            className="h-7 justify-start px-2 text-[11px]"
          >
            <Plus className="size-3" /> {i.icon} {i.label}
          </Button>
        ))}
      </div>
    </aside>
  );
}
