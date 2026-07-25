import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chatMessageSchema } from "@/lib/validations";

const HISTORY_SIZE = 50;

async function getSongWithAccess(songId: string, userId: string) {
  const song = await db.song.findUnique({
    where: { id: songId },
    select: { id: true, bandId: true },
  });
  if (!song) return { song: null, membership: null };

  const membership = await db.bandMember.findUnique({
    where: { userId_bandId: { userId, bandId: song.bandId } },
  });
  return { song, membership };
}

// Historial del chat de canción, más recientes al final.
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

  const messages = await db.chatMessage.findMany({
    where: { songId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_SIZE,
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ messages: messages.reverse() });
}

export async function POST(
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
  const parsed = chatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const message = await db.chatMessage.create({
    data: {
      content: parsed.data.content,
      bandId: song.bandId,
      songId,
      userId: session.user.id,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ message }, { status: 201 });
}
