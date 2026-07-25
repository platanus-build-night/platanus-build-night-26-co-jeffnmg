"use client";

import { useBroadcastEvent, useEventListener } from "@liveblocks/react";
import { useEffect, useRef, useState } from "react";

import { Textarea } from "@/components/ui/textarea";

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

const statusLabel: Record<SaveStatus, string> = {
  idle: "",
  dirty: "Cambios sin guardar…",
  saving: "Guardando…",
  saved: "Guardado ✓",
  error: "Error al guardar — reintentando",
};

export function LyricsEditor({
  songId,
  initialLyrics,
}: {
  songId: string;
  initialLyrics: string;
}) {
  const [lyrics, setLyrics] = useState(initialLyrics);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestLyrics = useRef(lyrics);
  const broadcast = useBroadcastEvent();

  // Cambios de otros miembros en vivo (last-write-wins; el autor persiste)
  useEventListener(({ event }) => {
    if (event.type !== "lyrics") return;
    setLyrics(event.lyrics);
    latestLyrics.current = event.lyrics;
  });

  async function save(value: string) {
    setStatus("saving");
    try {
      const res = await fetch(`/api/songs/${songId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics: value }),
      });
      if (!res.ok) throw new Error("save failed");
      // Si siguieron escribiendo mientras guardábamos, queda otro autosave pendiente
      setStatus(latestLyrics.current === value ? "saved" : "dirty");
    } catch {
      setStatus("error");
      timeoutRef.current = setTimeout(() => save(latestLyrics.current), 3000);
    }
  }

  function handleChange(value: string) {
    setLyrics(value);
    latestLyrics.current = value;
    broadcast({ type: "lyrics", lyrics: value });
    setStatus("dirty");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => save(value), 2000);
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Letra</h2>
        <span
          className={`text-xs ${
            status === "error" ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {statusLabel[status]}
        </span>
      </div>
      <Textarea
        value={lyrics}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={"Escribe la letra aquí…\n\n[Verso 1]\n…"}
        className="min-h-[50vh] font-mono text-sm leading-6"
      />
    </div>
  );
}
