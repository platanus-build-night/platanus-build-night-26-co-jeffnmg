"use client";

// Ensambla el Composer Studio: carga el score de la canción en el store,
// autoguarda con debounce contra /api/songs/[id], y arma el layout
// mixer | (transport + partitura + editor) | sidebar derecha.

import {
  useBroadcastEvent,
  useEventListener,
  useOthers,
  useSelf,
} from "@liveblocks/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, CloudUpload, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatPanel } from "@/modules/chat/components/ChatPanel";

import { player } from "../audio/player";
import { coerceScore, type Score } from "../model/score";
import { useComposer } from "../state/composer-store";
import { NoteEditor } from "./NoteEditor";
import { ScoreView } from "./ScoreView";
import { TheorySidebar } from "./TheorySidebar";
import { TrackMixer } from "./TrackMixer";
import { TranscribePanel } from "./TranscribePanel";
import { TransportBar } from "./TransportBar";

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

const AUTOSAVE_MS = 2000;

interface StudioShellProps {
  songId: string;
  songTitle: string;
  bandId: string;
  bandName: string;
  initialScore: unknown;
}

export function StudioShell({
  songId,
  songTitle,
  bandId,
  bandName,
  initialScore,
}: StudioShellProps) {
  const setScore = useComposer((s) => s.setScore);
  const score = useComposer((s) => s.score);

  const [sidebarTab, setSidebarTab] = useState("theory");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const loadedRef = useRef(false);
  const skipNextSaveRef = useRef(true);
  const remoteApplyRef = useRef(false);
  const lastToastRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Colaboración: presencia + broadcast del score (last-write-wins)
  const others = useOthers();
  const self = useSelf();
  const broadcast = useBroadcastEvent();

  useEventListener(({ event }) => {
    if (event.type !== "score") return;
    remoteApplyRef.current = true;
    setScore(coerceScore(event.score, songTitle));
    if (Date.now() - lastToastRef.current > 8000) {
      lastToastRef.current = Date.now();
      toast(`${event.author} actualizó la partitura`);
    }
  });

  // Cargar el score de la canción una sola vez
  if (!loadedRef.current) {
    loadedRef.current = true;
    setScore(coerceScore(initialScore, songTitle));
  }

  // Detener el audio al salir del estudio
  useEffect(() => {
    return () => player.stop();
  }, []);

  // Ante cambios locales del score: broadcast inmediato + autoguardado con
  // debounce. Los cambios que llegan de otros no se re-emiten ni se guardan
  // (el autor ya los persiste); así se evita el ping-pong entre clientes.
  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (remoteApplyRef.current) {
      remoteApplyRef.current = false;
      return;
    }
    broadcast({
      type: "score",
      score: JSON.parse(JSON.stringify(score)),
      author: self?.info?.name ?? "Alguien",
    });
    setSaveStatus("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void save(score), AUTOSAVE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  async function save(current: Score) {
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/songs/${songId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scoreJson: current,
          title: current.title || songTitle,
          bpm: current.bpm,
          key: current.key,
          timeSig: `${current.timeSig[0]}/${current.timeSig[1]}`,
        }),
      });
      setSaveStatus(res.ok ? "saved" : "error");
    } catch {
      setSaveStatus("error");
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      {/* Header contextual banda/canción */}
      <header className="flex items-center gap-3 border-b border-border bg-card/80 px-3 py-1.5">
        <Link
          href={`/bands/${bandId}/songs/${songId}`}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Volver
        </Link>
        <span className="min-w-0 truncate text-sm font-semibold">
          {bandName} <span className="text-muted-foreground">/</span>{" "}
          {score.title || songTitle}
        </span>
        {others.length > 0 && (
          <span className="flex items-center gap-1" title="También en el Studio">
            {others.map((other) => (
              <span
                key={other.connectionId}
                className="relative flex size-6 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold"
                title={other.info?.name}
              >
                {(other.info?.name ?? "?").charAt(0).toUpperCase()}
                <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-background" />
              </span>
            ))}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="size-3 animate-spin" /> Guardando…
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Check className="size-3 text-emerald-400" /> Guardado
            </>
          )}
          {saveStatus === "dirty" && (
            <>
              <CloudUpload className="size-3" /> Cambios sin guardar
            </>
          )}
          {saveStatus === "error" && (
            <span className="text-red-400">Error al guardar — se reintentará</span>
          )}
        </span>
      </header>

      <TransportBar />

      <div className="flex min-h-0 flex-1">
        <TrackMixer />

        <main className="flex min-w-0 flex-1 flex-col">
          <ScoreView />
          <NoteEditor />
        </main>

        <aside className="hidden w-64 shrink-0 flex-col border-l border-border bg-card/40 lg:flex xl:w-72">
          <div className="border-b border-border px-3 pt-2">
            <Tabs value={sidebarTab} onValueChange={setSidebarTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="theory" className="text-xs">
                  Teoría
                </TabsTrigger>
                <TabsTrigger value="transcribe" className="text-xs">
                  Transcribir
                </TabsTrigger>
                <TabsTrigger value="chat" className="text-xs">
                  Chat
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="min-h-0 flex-1">
            {sidebarTab === "theory" && <TheorySidebar />}
            {sidebarTab === "transcribe" && <TranscribePanel />}
            {sidebarTab === "chat" && (
              <ChatPanel
                endpoint={`/api/songs/${songId}/messages`}
                placeholder="Comenta sobre esta canción…"
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
