import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Crown, FileMusic, Plus } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InviteCode } from "@/modules/bands/components/InviteCode";

export const metadata = { title: "Banda — JamRoom" };

export default async function BandPage({
  params,
}: {
  params: Promise<{ bandId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { bandId } = await params;

  const membership = await db.bandMember.findUnique({
    where: { userId_bandId: { userId: session.user.id, bandId } },
  });
  if (!membership) redirect("/dashboard");

  const band = await db.band.findUnique({
    where: { id: bandId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { role: "asc" },
      },
      songs: {
        select: { id: true, title: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
  if (!band) notFound();

  return (
    <main className="min-h-dvh">
      <AnimatedBackground />
      <AppHeader
        chat={{
          roomId: `band:${band.id}`,
          endpoint: `/api/bands/${band.id}/messages`,
          title: `Chat de ${band.name}`,
        }}
      />

      <section className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{band.name}</h1>
            {band.description && (
              <p className="mt-1 text-muted-foreground">{band.description}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground">
              Código de invitación
            </span>
            <InviteCode code={band.inviteCode} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card className="bg-card/70">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Canciones</CardTitle>
                <Button size="sm" className="btn-glow" asChild>
                  <Link href={`/bands/${band.id}/songs/new`}>
                    <Plus />
                    Nueva canción
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {band.songs.length === 0 ? (
                <CardDescription>
                  Todavía no hay canciones. Crea la primera.
                </CardDescription>
              ) : (
                <ul className="flex flex-col divide-y">
                  {band.songs.map((song) => (
                    <li key={song.id}>
                      <Link
                        href={`/bands/${band.id}/songs/${song.id}`}
                        className="flex items-center gap-3 py-3 transition-colors hover:text-primary"
                      >
                        <FileMusic className="size-4 text-muted-foreground" />
                        <span className="font-medium">{song.title}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {new Date(song.updatedAt).toLocaleDateString("es", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="h-fit bg-card/70">
            <CardHeader>
              <CardTitle>Miembros</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3">
                {band.members.map((member) => (
                  <li key={member.id} className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/40 to-sky-500/40 text-sm font-semibold">
                      {member.user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm">{member.user.name}</span>
                    {member.role === "owner" && (
                      <Badge variant="secondary" className="ml-auto">
                        <Crown className="size-3" />
                        owner
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
