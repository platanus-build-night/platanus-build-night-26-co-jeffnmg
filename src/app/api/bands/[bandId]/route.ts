import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
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

  const band = await db.band.findUnique({
    where: { id: bandId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      songs: {
        select: { id: true, title: true, updatedAt: true, createdBy: true },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
  if (!band) {
    return NextResponse.json({ error: "Banda no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ band });
}
