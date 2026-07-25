import Link from "next/link";
import { Guitar, MessageSquare, Music4, Sparkles, Users } from "lucide-react";

import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    icon: Users,
    title: "Bandas y miembros",
    description:
      "Crea tu banda, invita a los integrantes con un código y trabajen juntos en un solo lugar.",
  },
  {
    icon: Music4,
    title: "Composer Studio",
    description:
      "Editor de partituras y tablaturas estilo Songsterr: multitrack, playback y export MIDI.",
  },
  {
    icon: MessageSquare,
    title: "Chat en contexto",
    description:
      "Conversaciones por banda y por canción: “el bajo entra en el compás 5”.",
  },
  {
    icon: Guitar,
    title: "Edición en vivo",
    description:
      "Letras y partituras sincronizadas en tiempo real entre todos los integrantes.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-dvh">
      <AnimatedBackground />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-sky-500 shadow-lg shadow-indigo-500/25">
            <Music4 className="size-4.5 text-white" />
          </span>
          <span className="text-lg font-bold tracking-tight">JamRoom</span>
        </div>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/login">Iniciar sesión</Link>
          </Button>
          <Button className="btn-glow" asChild>
            <Link href="/register">Crear cuenta</Link>
          </Button>
        </nav>
      </header>

      <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 pt-20 pb-16 text-center">
        <Badge
          variant="secondary"
          className="border border-indigo-400/30 bg-indigo-500/10 text-indigo-300"
        >
          <Sparkles className="size-3" />
          Platanus Build Night 2026
        </Badge>
        <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-6xl">
          El espacio de trabajo de <span className="text-gradient">tu banda</span>
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground text-balance">
          Songsterr + Discord para tu banda: partituras sincronizadas, chat y
          edición en vivo entre integrantes. Letras, tablaturas y composición en
          un solo lugar.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" className="btn-glow h-12 px-8 text-base" asChild>
            <Link href="/register">Empezar gratis</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 bg-background/50 px-8 text-base"
            asChild
          >
            <Link href="/login">Ya tengo cuenta</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-2">
        {features.map((feature) => (
          <Card
            key={feature.title}
            className="border-border/70 bg-card/70 transition-all hover:-translate-y-0.5 hover:border-indigo-400/40 hover:shadow-lg hover:shadow-indigo-500/10"
          >
            <CardHeader>
              <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-indigo-500/15">
                <feature.icon className="size-5 text-indigo-300" />
              </span>
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <footer className="border-t border-border/60 py-6 text-center text-sm text-muted-foreground">
        JamRoom — hecho para el Platanus Build Night
      </footer>
    </main>
  );
}
