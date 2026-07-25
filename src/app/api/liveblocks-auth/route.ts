import { Liveblocks } from "@liveblocks/node";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Rooms permitidas: band:{bandId} y song:{songId}.
// Solo los miembros de la banda correspondiente reciben token.
const ROOM_PATTERN = /^(band|song):([a-z0-9]+)$/;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { error: "Liveblocks no está configurado" },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  const room = body?.room;
  const match = typeof room === "string" ? ROOM_PATTERN.exec(room) : null;
  if (!match) {
    return NextResponse.json({ error: "Room inválida" }, { status: 400 });
  }

  const [, kind, id] = match;
  let bandId = id;
  if (kind === "song") {
    const song = await db.song.findUnique({
      where: { id },
      select: { bandId: true },
    });
    if (!song) {
      return NextResponse.json({ error: "Canción no encontrada" }, { status: 404 });
    }
    bandId = song.bandId;
  }

  const membership = await db.bandMember.findUnique({
    where: { userId_bandId: { userId: session.user.id, bandId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  const liveblocks = new Liveblocks({ secret });
  const lbSession = liveblocks.prepareSession(session.user.id, {
    userInfo: { name: session.user.name ?? "Miembro" },
  });
  lbSession.allow(room, lbSession.FULL_ACCESS);

  const { status, body: token } = await lbSession.authorize();
  return new Response(token, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
