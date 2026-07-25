import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export const maxDuration = 60; // la inferencia puede tardar

// Reenvía el audio (multipart) al servicio de transcripción.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const base = process.env.TRANSCRIBE_API_URL;
  if (!base) {
    return NextResponse.json(
      { error: "El servicio de transcripción no está configurado (TRANSCRIBE_API_URL)." },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Se esperaba un archivo de audio" }, { status: 400 });
  }

  try {
    const res = await fetch(`${base}/api/transcribe/notes`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(55_000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.detail ?? "El servicio de transcripción falló" },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "El servicio de transcripción no responde." },
      { status: 503 }
    );
  }
}
