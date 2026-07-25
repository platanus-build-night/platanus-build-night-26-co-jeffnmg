"use client";

// Botón de chat para la esquina superior derecha: abre un panel lateral
// con el chat de la banda o de la canción según el contexto de la página.
// La room de Liveblocks solo se monta cuando el panel está abierto.

import { MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CollabRoom } from "@/modules/collab/CollabRoom";

import { ChatPanel } from "./ChatPanel";

export interface ChatContext {
  roomId: string;
  endpoint: string;
  title: string;
}

export function ChatLauncher({ roomId, endpoint, title }: ChatContext) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <MessageSquare className="size-4 text-primary" />
          Chat
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full max-w-96 flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border !p-4">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <MessageSquare className="size-4 text-primary" />
            {title}
          </SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1">
          <CollabRoom roomId={roomId}>
            <ChatPanel endpoint={endpoint} />
          </CollabRoom>
        </div>
      </SheetContent>
    </Sheet>
  );
}
