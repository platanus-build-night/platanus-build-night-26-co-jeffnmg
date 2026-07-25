import Link from "next/link";
import { Music4 } from "lucide-react";

import { AnimatedBackground } from "@/components/AnimatedBackground";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4">
      <AnimatedBackground />
      <Link href="/" className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-sky-500 shadow-lg shadow-indigo-500/25">
          <Music4 className="size-5 text-white" />
        </span>
        <span className="text-2xl font-bold tracking-tight">JamRoom</span>
      </Link>
      {children}
    </main>
  );
}
