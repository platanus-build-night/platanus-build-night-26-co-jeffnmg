"use client";

// Regla de compases estilo Songsterr: números clicables.
// Click = seleccionar compás (punto de arranque del play).
// Shift+click = marcar/extender/quitar rango de loop.

import { useComposer } from "../state/composer-store";
import { MEASURE_WIDTH } from "./MeasureCanvas";

export const LABEL_WIDTH = 144;

export function MeasureRuler({ numMeasures }: { numMeasures: number }) {
  const loop = useComposer((s) => s.loop);
  const setLoop = useComposer((s) => s.setLoop);
  const selection = useComposer((s) => s.selection);
  const select = useComposer((s) => s.select);
  const activeTrackId = useComposer((s) => s.activeTrackId);

  function handleClick(measureIdx: number, e: React.MouseEvent) {
    if (e.shiftKey) {
      e.preventDefault();
      if (!loop) setLoop([measureIdx, measureIdx]);
      else if (measureIdx < loop[0]) setLoop([measureIdx, loop[1]]);
      else if (measureIdx > loop[1]) setLoop([loop[0], measureIdx]);
      else setLoop(null);
      return;
    }
    select({
      trackId: selection?.trackId ?? activeTrackId,
      measureIdx,
      eventId: null,
    });
  }

  return (
    <div className="sticky top-0 z-20 flex border-b border-border bg-background">
      <div
        className="sticky left-0 z-10 flex shrink-0 items-center border-r border-border bg-background px-3 text-[11px] uppercase tracking-wider text-muted-foreground"
        style={{ width: LABEL_WIDTH }}
      >
        Compás
      </div>
      {Array.from({ length: numMeasures }, (_, mi) => {
        const inLoop = loop && mi >= loop[0] && mi <= loop[1];
        const isSelected = selection?.measureIdx === mi;
        return (
          <button
            key={mi}
            type="button"
            onClick={(e) => handleClick(mi, e)}
            title="Clic: seleccionar · Shift+clic: loop"
            style={{ width: MEASURE_WIDTH }}
            className={`shrink-0 border-r border-border/50 py-1.5 text-center text-xs font-medium transition-colors ${
              inLoop
                ? "bg-blue-500/25 text-blue-300"
                : isSelected
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50"
            }`}
          >
            {mi + 1}
          </button>
        );
      })}
    </div>
  );
}
