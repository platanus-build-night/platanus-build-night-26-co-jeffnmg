import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppHeader } from "@/components/AppHeader";
import { CreateSongForm } from "@/modules/songs/components/CreateSongForm";

export const metadata = { title: "Nueva canción — JamRoom" };

export default async function NewSongPage({
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

  return (
    <main className="min-h-dvh">
      <AppHeader />
      <section className="mx-auto flex max-w-5xl justify-center px-6 py-12">
        <CreateSongForm bandId={bandId} />
      </section>
    </main>
  );
}
