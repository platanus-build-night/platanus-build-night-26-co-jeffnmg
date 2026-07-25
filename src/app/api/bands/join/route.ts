import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { joinBandSchema } from "@/lib/validations";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = joinBandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Código inválido" },
      { status: 400 }
    );
  }

  const band = await db.band.findUnique({
    where: { inviteCode: parsed.data.inviteCode },
  });
  if (!band) {
    return NextResponse.json(
      { error: "No existe una banda con ese código" },
      { status: 404 }
    );
  }

  const existing = await db.bandMember.findUnique({
    where: {
      userId_bandId: { userId: session.user.id, bandId: band.id },
    },
  });
  if (existing) {
    return NextResponse.json({ band, alreadyMember: true });
  }

  await db.bandMember.create({
    data: { userId: session.user.id, bandId: band.id, role: "member" },
  });

  return NextResponse.json({ band }, { status: 201 });
}
