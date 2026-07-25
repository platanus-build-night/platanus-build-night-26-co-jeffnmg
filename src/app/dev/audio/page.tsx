"use client";

// Página de prueba de la Fase 4 (solo dev): reproduce un score de ejemplo.

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { player } from "@/modules/composer/audio/player";
import {
  makeTrack,
  newId,
  type Score,
  type ScoreEvent,
} from "@/modules/composer/model/score";

function ev(
  start: number,
  name: "w" | "h" | "q" | "8" | "16",
  midis: number[]
): ScoreEvent {
  return {
    id: newId(),
    start,
    duration: { name, dotted: false },
    isRest: false,
    pitches: midis.map((midi) => ({ midi })),
  };
}

function demoScore(): Score {
  const guitar = makeTrack("guitar", 2);
  guitar.measures[0].events = [
    ev(0, "q", [60]),
    ev(1, "q", [64]),
    ev(2, "q", [67]),
    ev(3, "q", [72]),
  ];
  guitar.measures[1].events = [ev(0, "h", [60, 64, 67]), ev(2, "h", [55, 59, 62])];

  const bass = makeTrack("bass", 2);
  bass.measures[0].events = [ev(0, "h", [36]), ev(2, "h", [43])];
  bass.measures[1].events = [ev(0, "h", [36]), ev(2, "h", [31])];

  const drums = makeTrack("drums", 2);
  for (const m of drums.measures) {
    m.events = [
      ev(0, "q", [36]),
      ev(1, "q", [38]),
      ev(2, "q", [36]),
      ev(3, "q", [38]),
      ev(0.5, "8", [42]),
      ev(1.5, "8", [42]),
      ev(2.5, "8", [42]),
      ev(3.5, "8", [42]),
    ];
  }

  return {
    title: "Demo Fase 4",
    bpm: 110,
    timeSig: [4, 4],
    key: "C major",
    tracks: [guitar, bass, drums],
  };
}

export default function AudioTestPage() {
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState("detenido");
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const tick = () => {
      const pos = player.getPlayhead();
      setPlayhead(
        pos ? `compás ${pos.measureIdx + 1} · beat ${pos.beat.toFixed(2)}` : "detenido"
      );
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  async function play() {
    const score = demoScore();
    player.preload(score.tracks);
    await player.start(score, {
      speed: 1,
      loop: null,
      onStop: () => setPlaying(false),
    });
    setPlaying(true);
  }

  function stop() {
    player.stop();
    setPlaying(false);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6">
      <h1 className="text-xl font-bold">Prueba de audio — Fase 4</h1>
      <p className="font-mono text-sm text-muted-foreground" data-testid="playhead">
        {playhead}
      </p>
      <div className="flex gap-3">
        <Button onClick={play} disabled={playing}>
          Reproducir demo
        </Button>
        <Button onClick={stop} variant="outline" disabled={!playing}>
          Detener
        </Button>
      </div>
    </main>
  );
}
