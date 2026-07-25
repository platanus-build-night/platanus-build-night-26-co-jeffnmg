import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CollabRoom } from "@/modules/collab/CollabRoom";
import { StudioShell } from "@/modules/composer/components/StudioShell";

export const metadata = { title: "Studio — JamRoom" };

export default async function StudioPage({
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

  let initialScore: unknown = null;
  try {
    initialScore = JSON.parse(song.scoreJson);
  } catch {
    initialScore = null;
  }

  return (
    <CollabRoom roomId={`song:${song.id}`}>
      <StudioShell
        songId={song.id}
        songTitle={song.title}
        bandId={bandId}
        bandName={song.band.name}
        initialScore={initialScore}
      />
    </CollabRoom>
  );
}
