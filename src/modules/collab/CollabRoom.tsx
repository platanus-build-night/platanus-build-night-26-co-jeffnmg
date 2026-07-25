"use client";

// Envoltorio de Liveblocks: una room por banda (band:{id}) o canción (song:{id}).
// Los hijos pueden usar los hooks de @liveblocks/react (broadcast, presencia…).

import { LiveblocksProvider, RoomProvider } from "@liveblocks/react";
import type { ReactNode } from "react";

export function CollabRoom({
  roomId,
  children,
}: {
  roomId: string;
  children: ReactNode;
}) {
  return (
    <LiveblocksProvider authEndpoint="/api/liveblocks-auth" throttle={100}>
      <RoomProvider id={roomId} initialPresence={{ active: true }}>
        {children}
      </RoomProvider>
    </LiveblocksProvider>
  );
}
