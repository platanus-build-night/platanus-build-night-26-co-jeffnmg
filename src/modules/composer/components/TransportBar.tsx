"use client";

// Barra de transporte: play/stop (con precarga), BPM, velocidad, tonalidad,
// compás, loop activo, título y exportación MIDI/JSON.
// Space = play/stop (atajo global, salvo cuando se escribe en un campo).

import { useCallback, useEffect, useState } from "react";
import { Loader2, Play, Square, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { player } from "../audio/player";
import { downloadFile, exportProjectJson, scoreToMidi } from "../model/exporters";
import { useComposer } from "../state/composer-store";

const KEYS = [
  "C major", "G major", "D major", "A major", "E major", "F major",
  "Bb major", "Eb major", "A minor", "E minor", "B minor", "D minor",
  "G minor", "C minor",
];

const TIME_SIGS = ["4/4", "3/4", "2/4", "6/8", "12/8"];

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

const selectClass =
  "h-8 rounded-md border border-input bg-transparent px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring [&>option]:bg-popover";

export function TransportBar() {
  const score = useComposer((s) => s.score);
  const updateScore = useComposer((s) => s.updateScore);
  const isPlaying = useComposer((s) => s.isPlaying);
  const setPlaying = useComposer((s) => s.setPlaying);
  const speed = useComposer((s) => s.playbackSpeed);
  const setSpeed = useComposer((s) => s.setPlaybackSpeed);
  const loop = useComposer((s) => s.loop);
  const setLoop = useComposer((s) => s.setLoop);
  const selection = useComposer((s) => s.selection);

  const [loading, setLoading] = useState(false);

  const togglePlay = useCallback(async () => {
    if (isPlaying || loading) {
      player.stop();
      setPlaying(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // El cursor no se activa hasta que los samples cargaron: sin "atraso"
      await player.start(score, {
        speed,
        loop,
        startMeasure: selection?.measureIdx ?? 0,
        onStop: () => {
          setPlaying(false);
          setLoading(false);
        },
      });
      setPlaying(true);
    } catch {
      setLoading(false);
    }
  }, [isPlaying, loading, score, speed, loop, selection, setPlaying]);

  // Atajo global: Space = play/stop
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space" || isTypingTarget(e.target)) return;
      e.preventDefault();
      void togglePlay();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePlay]);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/60 px-3 py-2">
      <Button
        size="sm"
        onClick={() => void togglePlay()}
        disabled={loading && !isPlaying}
        className={isPlaying ? "bg-red-600 text-white hover:bg-red-700" : ""}
      >
        {loading && !isPlaying ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Cargando
          </>
        ) : isPlaying ? (
          <>
            <Square className="size-4" /> Parar
          </>
        ) : (
          <>
            <Play className="size-4" /> Reproducir
          </>
        )}
      </Button>

      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        BPM
        <Input
          type="number"
          min={30}
          max={300}
          value={score.bpm}
          onChange={(e) =>
            updateScore((s) => {
              s.bpm = Math.min(300, Math.max(30, Number(e.target.value) || 100));
            })
          }
          className="h-8 w-16 text-xs"
        />
      </label>

      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Velocidad
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className={selectClass}
        >
          {SPEEDS.map((v) => (
            <option key={v} value={v}>
              {v * 100}%
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Tonalidad
        <select
          value={score.key}
          onChange={(e) =>
            updateScore((s) => {
              s.key = e.target.value;
            })
          }
          className={selectClass}
        >
          {KEYS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Compás
        <select
          value={`${score.timeSig[0]}/${score.timeSig[1]}`}
          onChange={(e) => {
            const [n, d] = e.target.value.split("/").map(Number);
            updateScore((s) => {
              s.timeSig = [n, d];
            });
          }}
          className={selectClass}
        >
          {TIME_SIGS.map((ts) => (
            <option key={ts} value={ts}>
              {ts}
            </option>
          ))}
        </select>
      </label>

      {loop ? (
        <Button size="sm" variant="secondary" onClick={() => setLoop(null)}>
          Loop {loop[0] + 1}–{loop[1] + 1} <X className="size-3" />
        </Button>
      ) : (
        <span className="hidden text-[11px] text-muted-foreground xl:inline">
          Shift+clic en la regla para loop
        </span>
      )}

      <div className="flex-1" />

      <Input
        value={score.title}
        onChange={(e) =>
          updateScore((s) => {
            s.title = e.target.value;
          })
        }
        className="h-8 w-36 min-w-0 text-xs font-medium"
        aria-label="Título de la composición"
      />

      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          downloadFile(scoreToMidi(score), `${score.title || "composicion"}.mid`, "audio/midi")
        }
      >
        Exportar MIDI
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          downloadFile(
            exportProjectJson(score),
            `${score.title || "composicion"}.json`,
            "application/json"
          )
        }
      >
        JSON
      </Button>
    </div>
  );
}
