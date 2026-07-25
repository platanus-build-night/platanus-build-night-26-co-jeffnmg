"use client";

// Partitura principal: una fila por pista (labels fijos a la izquierda),
// compases en scroll horizontal y cursor de reproducción rojo animado con
// requestAnimationFrame directo al DOM (nunca re-render de React por frame).

import { useEffect, useRef } from "react";

import { player } from "../audio/player";
import { beatsPerMeasure, totalMeasures } from "../model/score";
import { soundLabel } from "../model/sounds";
import { useComposer } from "../state/composer-store";
import {
  MEASURE_WIDTH,
  MeasureCanvas,
  STAFF_ROW_HEIGHT,
  TAB_ROW_HEIGHT,
} from "./MeasureCanvas";
import { LABEL_WIDTH, MeasureRuler } from "./MeasureRuler";

const INSTRUMENT_ICON: Record<string, string> = {
  guitar: "🎸",
  bass: "🎸",
  piano: "🎹",
  drums: "🥁",
  voice: "🎤",
};

export function ScoreView() {
  const score = useComposer((s) => s.score);
  const selection = useComposer((s) => s.selection);
  const select = useComposer((s) => s.select);
  const isPlaying = useComposer((s) => s.isPlaying);
  const multitrack = useComposer((s) => s.multitrack);
  const activeTrackId = useComposer((s) => s.activeTrackId);
  const setActiveTrack = useComposer((s) => s.setActiveTrack);
  const loop = useComposer((s) => s.loop);

  const scrollRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  const visibleTracks = multitrack
    ? score.tracks.filter((t) => t.visible)
    : score.tracks.filter((t) => t.id === activeTrackId);
  const numMeasures = totalMeasures(score);
  const measureBeats = beatsPerMeasure(score);

  // Cursor de reproducción: rAF → transform en el DOM, y auto-scroll
  // instantáneo cuando el cursor cambia de compás.
  useEffect(() => {
    if (!isPlaying) return;
    const cursorEl = cursorRef.current;
    let raf = 0;
    let lastMeasure = -1;

    const tick = () => {
      const pos = player.getPlayhead();
      const cursor = cursorRef.current;
      const scroller = scrollRef.current;
      if (pos && cursor) {
        const x =
          LABEL_WIDTH +
          pos.measureIdx * MEASURE_WIDTH +
          30 +
          (pos.beat / measureBeats) * (MEASURE_WIDTH - 40);
        cursor.style.transform = `translateX(${x}px)`;
        cursor.style.opacity = "1";

        if (scroller && pos.measureIdx !== lastMeasure) {
          lastMeasure = pos.measureIdx;
          const measureX = LABEL_WIDTH + pos.measureIdx * MEASURE_WIDTH;
          const outOfView =
            measureX < scroller.scrollLeft + LABEL_WIDTH ||
            measureX > scroller.scrollLeft + scroller.clientWidth - MEASURE_WIDTH;
          if (outOfView) {
            scroller.scrollLeft = Math.max(0, measureX - LABEL_WIDTH - 20);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (cursorEl) cursorEl.style.opacity = "0";
    };
  }, [isPlaying, measureBeats]);

  const contentWidth = LABEL_WIDTH + numMeasures * MEASURE_WIDTH + 40;

  return (
    <div ref={scrollRef} className="relative flex-1 overflow-auto">
      <div className="relative" style={{ width: contentWidth, minWidth: "100%" }}>
        <MeasureRuler numMeasures={numMeasures} />

        {visibleTracks.map((track) => {
          const isActive = track.id === activeTrackId;
          const rowHeight =
            track.instrument === "guitar" || track.instrument === "bass"
              ? TAB_ROW_HEIGHT
              : STAFF_ROW_HEIGHT;
          return (
            <div
              key={track.id}
              className={`flex border-b border-border/60 ${
                isActive ? "bg-blue-500/[0.04]" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveTrack(track.id)}
                style={{ width: LABEL_WIDTH, height: rowHeight }}
                className={`sticky left-0 z-10 flex shrink-0 flex-col items-start justify-center gap-1 overflow-hidden border-r px-3 text-left transition-colors ${
                  isActive
                    ? "border-blue-500/60 bg-background text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="flex w-full min-w-0 items-center gap-1.5 text-sm font-semibold">
                  <span aria-hidden className="shrink-0">
                    {INSTRUMENT_ICON[track.instrument]}
                  </span>
                  <span className="min-w-0 truncate">{track.name}</span>
                </span>
                <span className="max-w-full truncate text-[11px]">
                  {soundLabel(track.instrument, track.sound)}
                  {track.tuning && (track.capo ?? 0) > 0 ? ` · capo ${track.capo}` : ""}
                </span>
                {(track.mute || track.solo) && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-blue-400">
                    {track.solo ? "Solo" : "Mute"}
                  </span>
                )}
              </button>

              {track.measures.map((measure, mi) => {
                const isSelectedMeasure =
                  selection?.trackId === track.id && selection.measureIdx === mi;
                const inLoop = loop && mi >= loop[0] && mi <= loop[1];
                return (
                  <div
                    key={mi}
                    onClick={() => {
                      setActiveTrack(track.id);
                      if (!isSelectedMeasure) {
                        select({ trackId: track.id, measureIdx: mi, eventId: null });
                      }
                    }}
                    className={`relative shrink-0 ${
                      isSelectedMeasure ? "bg-blue-500/10" : ""
                    } ${inLoop ? "bg-blue-500/[0.07]" : ""}`}
                  >
                    <MeasureCanvas
                      score={score}
                      track={track}
                      measure={measure}
                      isFirst={mi === 0}
                      selectedEventId={isSelectedMeasure ? selection.eventId : null}
                      onSelectEvent={(eventId) =>
                        select({ trackId: track.id, measureIdx: mi, eventId })
                      }
                    />
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Cursor de reproducción */}
        <div
          ref={cursorRef}
          className="pointer-events-none absolute bottom-0 left-0 top-8 w-[2px] bg-red-500"
          style={{ opacity: 0 }}
        />
      </div>
    </div>
  );
}
