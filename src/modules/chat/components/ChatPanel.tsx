"use client";

// Panel de chat genérico: lista con auto-scroll + input.
// Enter envía, Shift+Enter hace nueva línea. Requiere estar dentro de CollabRoom.

import { Loader2, SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { useChat } from "../hooks/useChat";

function timeLabel(iso: string): string {
  const date = new Date(iso);
  const diffMin = Math.round((Date.now() - date.getTime()) / 60_000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  return date.toLocaleString("es", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatPanel({
  endpoint,
  placeholder = "Escribe un mensaje…",
}: {
  endpoint: string;
  placeholder?: string;
}) {
  const { messages, loading, error, send } = useChat(endpoint);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function handleSend() {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await send(content);
      setDraft("");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "No se pudo enviar");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {loading && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Cargando historial…
          </p>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
        {!loading && !error && messages.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Aún no hay mensajes. Escribe el primero.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="text-xs">
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">{m.user.name}</span>{" "}
              · {timeLabel(m.createdAt)}
            </p>
            <p className="mt-0.5 whitespace-pre-wrap break-words">{m.content}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-border p-2">
        {sendError && <p className="mb-1 text-xs text-red-400">{sendError}</p>}
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={placeholder}
            rows={1}
            className="max-h-24 min-h-9 flex-1 resize-none text-xs"
          />
          <Button
            size="icon"
            className="size-9 shrink-0"
            disabled={!draft.trim() || sending}
            onClick={() => void handleSend()}
            aria-label="Enviar mensaje"
          >
            <SendHorizontal className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
