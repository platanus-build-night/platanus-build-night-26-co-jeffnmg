// Tipos globales de Liveblocks para toda la app.

import type { Json } from "@liveblocks/client";

/** Mensaje de chat tal como lo devuelven las APIs /messages. */
export type ChatMessageDTO = {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string };
};

declare global {
  interface Liveblocks {
    Presence: {
      active: boolean;
    };
    UserMeta: {
      id: string;
      info: { name: string };
    };
    RoomEvent:
      | { type: "chat"; message: ChatMessageDTO }
      | { type: "lyrics"; lyrics: string }
      // El score viaja como Json plano; el receptor lo valida con coerceScore
      | { type: "score"; score: Json; author: string };
  }
}
