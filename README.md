# JamRoom

Espacio de trabajo para bandas: miembros, canciones, letras, chat y un **Composer Studio** estilo Songsterr/Guitar Pro con edición colaborativa en vivo.

> Songsterr + Discord para tu banda — partituras sincronizadas, chat y edición en vivo.

**Demo:** https://jamroom-two.vercel.app

## Stack

- Next.js 15 · TypeScript · Tailwind · shadcn/ui
- Auth.js · Prisma · Neon (PostgreSQL)
- Zustand · VexFlow · Tone.js · tonal · smplr
- Liveblocks (presencia, sync, chat)
- FastAPI + Basic Pitch en Render (transcripción)

## Cómo correr

```bash
npm install
cp .env.example .env   # DATABASE_URL, AUTH_SECRET, Liveblocks, TRANSCRIBE_API_URL
npx prisma db push
npm run dev
```

Abrir http://localhost:3000

```bash
npm test
```

## Deploy

| Pieza | Servicio | URL |
|-------|----------|-----|
| App | Vercel | https://jamroom-two.vercel.app |
| DB | Neon | PostgreSQL |
| Transcripción | Render | https://jamroom-transcribe.onrender.com |

El deploy de Vercel/Render está conectado al repo personal [`jeffnmg/JamRoom`](https://github.com/jeffnmg/JamRoom) (mirror); este repo de la org se usa para la entrega.
