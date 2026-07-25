import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateSongSchema } from "@/lib/validations";

async function getSongWithAccess(songId: string, userId: string) {
  const song = await db.song.findUnique({ where: { id: songId } });
  if (!song) return { song: null, membership: null };

  const membership = await db.bandMember.findUnique({
    where: { userId_bandId: { userId, bandId: song.bandId } },
  });
  return { song, membership };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ songId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { songId } = await params;
  const { song, membership } = await getSongWithAccess(songId, session.user.id);

  if (!song) {
    return NextResponse.json({ error: "Canción no encontrada" }, { status: 404 });
  }
  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  return NextResponse.json({
    song: { ...song, scoreJson: JSON.parse(song.scoreJson) },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ songId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { songId } = await params;
  const { song, membership } = await getSongWithAccess(songId, session.user.id);

  if (!song) {
    return NextResponse.json({ error: "Canción no encontrada" }, { status: 404 });
  }
  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSongSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const { scoreJson, ...rest } = parsed.data;

  const updated = await db.song.update({
    where: { id: songId },
    data: {
      ...rest,
      ...(scoreJson !== undefined
        ? { scoreJson: JSON.stringify(scoreJson) }
        : {}),
    },
  });

  return NextResponse.json({
    song: { ...updated, scoreJson: JSON.parse(updated.scoreJson) },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ songId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { songId } = await params;
  const { song, membership } = await getSongWithAccess(songId, session.user.id);

  if (!song) {
    return NextResponse.json({ error: "Canción no encontrada" }, { status: 404 });
  }
  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  const canDelete =
    membership.role === "owner" || song.createdBy === session.user.id;
  if (!canDelete) {
    return NextResponse.json(
      { error: "Solo el owner de la banda o quien creó la canción puede eliminarla" },
      { status: 403 }
    );
  }

  await db.song.delete({ where: { id: songId } });
  return NextResponse.json({ ok: true });
}
