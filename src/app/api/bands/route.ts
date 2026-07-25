import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateInviteCode } from "@/lib/invite-code";
import { createBandSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const bands = await db.band.findMany({
    where: { members: { some: { userId: session.user.id } } },
    include: { _count: { select: { members: true, songs: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ bands });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createBandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  // Reintenta si el código generado colisiona (unique constraint)
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const band = await db.band.create({
        data: {
          name: parsed.data.name,
          description: parsed.data.description,
          inviteCode: generateInviteCode(),
          members: {
            create: { userId: session.user.id, role: "owner" },
          },
        },
      });
      return NextResponse.json({ band }, { status: 201 });
    } catch (e) {
      const isUniqueViolation =
        typeof e === "object" && e !== null && "code" in e && e.code === "P2002";
      if (!isUniqueViolation) throw e;
    }
  }

  return NextResponse.json(
    { error: "No se pudo generar el código de invitación" },
    { status: 500 }
  );
}
