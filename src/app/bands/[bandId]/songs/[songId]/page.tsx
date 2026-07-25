import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, AudioLines } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollabRoom } from "@/modules/collab/CollabRoom";
import { DeleteSongButton } from "@/modules/songs/components/DeleteSongButton";
import { LyricsEditor } from "@/modules/songs/components/LyricsEditor";

export const metadata = { title: "Canción — JamRoom" };

export default async function SongPage({
  params,
}: {
  params: Promise<{ bandId: string; songId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { bandId, songId } = await params;

  const membership = await db.bandMember.findUnique({
    where: { userId_bandId: { userId: session.user.id, bandId } },
  });
  if (!membership) redirect("/dashboard");

  const song = await db.song.findUnique({
    where: { id: songId },
    include: { band: { select: { name: true } } },
  });
  if (!song || song.bandId !== bandId) notFound();

  const canDelete =
    membership.role === "owner" || song.createdBy === session.user.id;

  return (
    <main className="min-h-dvh">
      <AnimatedBackground />
      <AppHeader
        chat={{
          roomId: `song:${song.id}`,
          endpoint: `/api/songs/${song.id}/messages`,
          title: `Chat — ${song.title}`,
        }}
      />

      <section className="mx-auto max-w-4xl px-6 py-8">
        <Link
          href={`/bands/${bandId}`}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {song.band.name}
        </Link>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{song.title}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">{song.bpm} BPM</Badge>
              <Badge variant="secondary">{song.key}</Badge>
              <Badge variant="secondary">{song.timeSig}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="lg" className="btn-glow h-11 px-6 text-base" asChild>
              <Link href={`/bands/${bandId}/songs/${songId}/studio`}>
                <AudioLines className="size-5" />
                Abrir Studio
              </Link>
            </Button>
            {canDelete && <DeleteSongButton songId={song.id} bandId={bandId} />}
          </div>
        </div>

        <CollabRoom roomId={`song:${song.id}`}>
          <LyricsEditor songId={song.id} initialLyrics={song.lyrics} />
        </CollabRoom>
      </section>
    </main>
  );
}
