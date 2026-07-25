import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chatMessageSchema } from "@/lib/validations";

const HISTORY_SIZE = 50;

async function requireMembership(bandId: string, userId: string) {
  return db.bandMember.findUnique({
    where: { userId_bandId: { userId, bandId } },
  });
}

// Historial del chat de banda (songId = null), más recientes al final.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bandId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { bandId } = await params;
  if (!(await requireMembership(bandId, session.user.id))) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  const messages = await db.chatMessage.findMany({
    where: { bandId, songId: null },
    orderBy: { createdAt: "desc" },
    take: HISTORY_SIZE,
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ messages: messages.reverse() });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ bandId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { bandId } = await params;
  if (!(await requireMembership(bandId, session.user.id))) {
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
      bandId,
      userId: session.user.id,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ message }, { status: 201 });
}
