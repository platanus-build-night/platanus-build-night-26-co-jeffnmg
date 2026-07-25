"use client";

// Chat con historial en Postgres + broadcast en vivo por Liveblocks.
// Debe usarse dentro de una CollabRoom.

import { useBroadcastEvent, useEventListener } from "@liveblocks/react";
import { useEffect, useState } from "react";

import type { ChatMessageDTO } from "@/liveblocks.config";

export function useChat(endpoint: string) {
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const broadcast = useBroadcastEvent();

  useEffect(() => {
    let cancelled = false;
    fetch(endpoint)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const data = await r.json();
        if (!cancelled) setMessages(data.messages ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar el historial");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  useEventListener(({ event }) => {
    if (event.type !== "chat") return;
    setMessages((prev) =>
      prev.some((m) => m.id === event.message.id) ? prev : [...prev, event.message]
    );
  });

  async function send(content: string) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error ?? "No se pudo enviar el mensaje");
    }
    const message = data.message as ChatMessageDTO;
    setMessages((prev) => [...prev, message]);
    broadcast({ type: "chat", message });
  }

  return { messages, loading, error, send };
}
