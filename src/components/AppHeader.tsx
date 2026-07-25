import Link from "next/link";
import { LogOut, Music4 } from "lucide-react";

import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  ChatLauncher,
  type ChatContext,
} from "@/modules/chat/components/ChatLauncher";

export async function AppHeader({ chat }: { chat?: ChatContext }) {
  const session = await auth();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
        <Link href="/dashboard" className="group flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-sky-500 shadow-lg shadow-indigo-500/25 transition-transform group-hover:scale-105">
            <Music4 className="size-4.5 text-white" />
          </span>
          <span className="text-lg font-bold tracking-tight">JamRoom</span>
        </Link>
        {session?.user && (
          <div className="flex items-center gap-3">
            {chat && <ChatLauncher {...chat} />}
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {session.user.name}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <Button variant="ghost" size="sm" type="submit">
                <LogOut />
                Salir
              </Button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
