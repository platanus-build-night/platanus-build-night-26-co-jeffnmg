"use client";

// Transcripción: graba con el micrófono o sube un archivo; Basic Pitch
// detecta las notas y se insertan como una pista nueva (borrador editable).
// El "destino" solo decide con qué instrumento/sonido se escribe la pista.

import { useEffect, useRef, useState } from "react";
import { CircleStop, FileAudio, Mic, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

import { blobToMonoWav } from "../audio/wav";
import {
  countTrackNotes,
  rawNotesToTrack,
  type RawNote,
} from "../model/quantize";
import { normalizeMeasureCount, type Instrument } from "../model/score";
import { useComposer } from "../state/composer-store";

type Status =
  | { kind: "idle" }
  | { kind: "recording" }
  | { kind: "processing" }
  | { kind: "done"; detected: number; written: number; bpm: number | null }
  | { kind: "error"; message: string };

type Availability = "checking" | "ok" | "no-models" | "offline" | "unconfigured";

interface Target {
  id: string;
  label: string;
  instrument: Instrument;
  sound?: string;
}

const TARGETS: Target[] = [
  { id: "voice", label: "Voz / melodía", instrument: "voice", sound: "choir" },
  { id: "guitar-ac", label: "Guitarra acústica", instrument: "guitar", sound: "acoustic" },
  { id: "guitar-clean", label: "Guitarra eléctrica limpia", instrument: "guitar", sound: "clean" },
  { id: "guitar-dist", label: "Guitarra distorsión", instrument: "guitar", sound: "distortion" },
  { id: "bass", label: "Bajo finger", instrument: "bass", sound: "finger" },
  { id: "piano", label: "Piano de cola", instrument: "piano", sound: "grand" },
  { id: "piano-ep", label: "Piano eléctrico", instrument: "piano", sound: "electric" },
];

const selectClass =
  "h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs text-foreground focus:outline-none [&>option]:bg-popover";

export function TranscribePanel() {
  const score = useComposer((s) => s.score);
  const updateScore = useComposer((s) => s.updateScore);

  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [availability, setAvailability] = useState<Availability>("checking");
  const [targetId, setTargetId] = useState("voice");
  const [useDetectedBpm, setUseDetectedBpm] = useState(true);
  const [conservative, setConservative] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Última detección: permite re-insertar con otros ajustes sin re-grabar
  const lastResultRef = useRef<{ notes: RawNote[]; bpm: number | null } | null>(null);

  const target = TARGETS.find((t) => t.id === targetId) ?? TARGETS[0];

  useEffect(() => {
    fetch("/api/transcribe/status")
      .then(async (r) => {
        const d = await r.json();
        if (!d.configured) setAvailability("unconfigured");
        else if (d.offline) setAvailability("offline");
        else setAvailability(d.basicPitch ? "ok" : "no-models");
      })
      .catch(() => setAvailability("offline"));
  }, []);

  /** Cuantiza e inserta como pista nueva; devuelve cuántas notas se escribieron. */
  function insertTrack(notes: RawNote[], bpm: number | null): number {
    const effectiveBpm = useDetectedBpm && bpm ? Math.round(bpm) : score.bpm;
    let written = 0;
    updateScore((s) => {
      if (useDetectedBpm && bpm) s.bpm = Math.round(bpm);
      const track = rawNotesToTrack(
        notes,
        effectiveBpm,
        s,
        target.instrument,
        `${target.label} (audio)`,
        target.sound,
        { conservative }
      );
      written = countTrackNotes(track);
      s.tracks.push(track);
      normalizeMeasureCount(s);
    });
    return written;
  }

  async function transcribe(blob: Blob) {
    setStatus({ kind: "processing" });
    try {
      const wav = await blobToMonoWav(blob);
      const form = new FormData();
      form.append("file", wav, "audio.wav");

      const res = await fetch("/api/transcribe/notes", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "El servicio de transcripción falló.");
      }

      const { notes, bpm } = data as { notes: RawNote[]; bpm: number | null };
      if (!notes || notes.length === 0) {
        setStatus({
          kind: "error",
          message: "No se detectaron notas. Graba más cerca del micrófono y sin ruido de fondo.",
        });
        return;
      }

      lastResultRef.current = { notes, bpm };
      const written = insertTrack(notes, bpm);
      setStatus({ kind: "done", detected: notes.length, written, bpm });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Error desconocido",
      });
    }
  }

  /** Re-inserta la última detección con los ajustes actuales (sin re-grabar). */
  function retranscribe() {
    const last = lastResultRef.current;
    if (!last) return;
    const written = insertTrack(last.notes, last.bpm);
    setStatus({ kind: "done", detected: last.notes.length, written, bpm: last.bpm });
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void transcribe(new Blob(chunksRef.current, { type: recorder.mimeType }));
      };
      recorder.start();
      recorderRef.current = recorder;
      setStatus({ kind: "recording" });
    } catch {
      setStatus({ kind: "error", message: "No se pudo acceder al micrófono." });
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  const busy = status.kind === "processing" || status.kind === "recording";

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 text-xs">
      {availability === "unconfigured" && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-amber-300">
          El servicio de transcripción no está configurado. Define{" "}
          <code>TRANSCRIBE_API_URL</code> en el entorno.
        </p>
      )}
      {availability === "offline" && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-amber-300">
          El servicio de transcripción no responde. Arranca el servicio:{" "}
          <code>uvicorn app.main:app --port 8000</code> en{" "}
          <code>services/transcribe/</code>.
        </p>
      )}
      {availability === "no-models" && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-amber-300">
          El servicio corre pero sin modelos. Instala:{" "}
          <code>pip install -r requirements.txt</code>
        </p>
      )}

      <label className="space-y-1">
        <span className="text-muted-foreground">Destino (cómo se escribe y suena)</span>
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className={selectClass}
        >
          {TARGETS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1">
        <span className="text-muted-foreground">Cuantización</span>
        <select
          value={conservative ? "conservative" : "normal"}
          onChange={(e) => setConservative(e.target.value === "conservative")}
          className={selectClass}
        >
          <option value="normal">Normal (agrupa acordes)</option>
          <option value="conservative">Conservadora (conserva más notas)</option>
        </select>
      </label>

      <div className="space-y-1">
        <label className="flex items-center gap-2 text-muted-foreground">
          <input
            type="checkbox"
            checked={useDetectedBpm}
            onChange={(e) => setUseDetectedBpm(e.target.checked)}
            className="accent-blue-500"
          />
          Usar el tempo detectado en el audio
        </label>
        <p className="pl-5 text-[11px] text-muted-foreground/70">
          Si las notas salen corridas, desactívalo y ajusta el BPM a mano.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {status.kind === "recording" ? (
          <Button
            size="sm"
            onClick={stopRecording}
            className="w-full bg-red-600 text-white hover:bg-red-700"
          >
            <CircleStop className="size-3.5" /> Detener y transcribir
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={busy || availability !== "ok"}
            onClick={startRecording}
            className="w-full bg-red-600/90 text-white hover:bg-red-600"
          >
            <Mic className="size-3.5" /> Grabar micrófono
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={busy || availability !== "ok"}
          onClick={() => fileInputRef.current?.click()}
        >
          <FileAudio className="size-3.5" /> Subir archivo
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.webm"
        hidden
        data-testid="transcribe-file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void transcribe(file);
          e.target.value = "";
        }}
      />

      {status.kind === "recording" && (
        <p className="text-red-400">
          Grabando… tararea o toca; se escribirá como <strong>{target.label}</strong>.
        </p>
      )}
      {status.kind === "processing" && (
        <p className="text-muted-foreground">Analizando audio… puede tardar unos segundos.</p>
      )}
      {status.kind === "done" && (
        <div className="space-y-2">
          <p className="text-emerald-400">
            {status.detected} notas detectadas → {status.written} escritas en la
            partitura como {target.label}
            {status.bpm ? ` (tempo ≈ ${Math.round(status.bpm)} BPM)` : ""}. Pista
            nueva, borrador editable.
          </p>
          <Button size="sm" variant="outline" onClick={retranscribe}>
            <RotateCcw className="size-3.5" /> Transcribir de nuevo con estos ajustes
          </Button>
          <p className="text-[11px] text-muted-foreground/70">
            Cambia cuantización/destino/tempo y re-inserta sin volver a grabar
            (agrega otra pista; borra la que no te guste).
          </p>
        </div>
      )}
      {status.kind === "error" && <p className="text-red-400">{status.message}</p>}

      <div className="mt-auto space-y-1 rounded-md border border-border bg-card/60 p-2 text-[11px] text-muted-foreground">
        <p className="font-semibold text-foreground">Tips para mejores resultados</p>
        <ul className="list-disc space-y-0.5 pl-4">
          <li>Graba cerca del micrófono y sin ruido de fondo.</li>
          <li>Una sola voz o instrumento a la vez (monofónico funciona mejor).</li>
          <li>Voz y tarareo se detectan mejor que acordes de guitarra.</li>
          <li>La transcripción siempre es un borrador editable.</li>
        </ul>
      </div>
    </div>
  );
}
