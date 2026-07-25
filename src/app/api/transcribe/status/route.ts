import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

// Proxy al servicio de transcripción: la URL vive solo en el servidor.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const base = process.env.TRANSCRIBE_API_URL;
  if (!base) {
    return NextResponse.json({
      configured: false,
      basicPitch: false,
      tempoDetection: false,
    });
  }

  try {
    const res = await fetch(`${base}/api/transcribe/status`, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    return NextResponse.json({ configured: true, ...data });
  } catch {
    return NextResponse.json(
      { configured: true, offline: true, basicPitch: false, tempoDetection: false },
      { status: 503 }
    );
  }
}
