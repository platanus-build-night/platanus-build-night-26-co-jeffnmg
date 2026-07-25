import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createSongSchema } from "@/lib/validations";
import { makeDefaultScore } from "@/modules/composer/model/score";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ bandId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { bandId } = await params;

  const membership = await db.bandMember.findUnique({
    where: { userId_bandId: { userId: session.user.id, bandId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSongSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const song = await db.song.create({
    data: {
      title: parsed.data.title,
      bandId,
      createdBy: session.user.id,
      scoreJson: JSON.stringify(makeDefaultScore(parsed.data.title)),
    },
  });

  return NextResponse.json({ song }, { status: 201 });
}
