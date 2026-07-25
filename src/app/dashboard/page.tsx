import Link from "next/link";
import { redirect } from "next/navigation";
import { Music4, Plus, Users } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { JoinBandForm } from "@/modules/bands/components/JoinBandForm";

export const metadata = { title: "Dashboard — JamRoom" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const bands = await db.band.findMany({
    where: { members: { some: { userId: session.user.id } } },
    include: { _count: { select: { members: true, songs: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-dvh">
      <AnimatedBackground />
      <AppHeader />

      <section className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Mis bandas</h1>
          <div className="flex flex-wrap items-center gap-3">
            <JoinBandForm />
            <Button className="btn-glow" asChild>
              <Link href="/bands/new">
                <Plus />
                Crear banda
              </Link>
            </Button>
          </div>
        </div>

        {bands.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Todavía no tienes bandas</CardTitle>
              <CardDescription>
                Crea una banda o únete con el código que te compartió un
                compañero.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bands.map((band) => (
              <Link key={band.id} href={`/bands/${band.id}`}>
                <Card className="h-full bg-card/70 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg hover:shadow-indigo-500/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Music4 className="size-5 text-primary" />
                      {band.name}
                    </CardTitle>
                    {band.description && (
                      <CardDescription className="line-clamp-2">
                        {band.description}
                      </CardDescription>
                    )}
                    <div className="mt-2 flex gap-2">
                      <Badge variant="secondary">
                        <Users className="size-3" />
                        {band._count.members}
                      </Badge>
                      <Badge variant="secondary">
                        {band._count.songs}{" "}
                        {band._count.songs === 1 ? "canción" : "canciones"}
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
