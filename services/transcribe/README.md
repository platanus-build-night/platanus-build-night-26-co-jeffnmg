# JamRoom — servicio de transcripción

FastAPI que convierte audio en notas crudas con **Basic Pitch** (Spotify) y
estima el BPM con **librosa**. La app Next.js lo consume vía
`TRANSCRIBE_API_URL` a través de su proxy `/api/transcribe/*`.

## Endpoints

| Método | Ruta                    | Descripción                                        |
| ------ | ----------------------- | -------------------------------------------------- |
| GET    | `/api/health`           | Ping                                               |
| GET    | `/api/transcribe/status`| Capacidades: `{ basicPitch, tempoDetection }`      |
| POST   | `/api/transcribe/notes` | `multipart file` → `{ notes: [...], bpm }`         |

Cada nota: `{ midi, startSec, durationSec, velocity }`.

## Correr local

```bash
cd services/transcribe
python -m venv .venv
.venv\Scripts\activate      # Windows (Linux/Mac: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

Y en la app: `TRANSCRIBE_API_URL=http://localhost:8000`.

## Deploy en Render

- Root directory: `services/transcribe`
- Runtime: Docker (usa el `Dockerfile`)
- Copiar la URL pública a `TRANSCRIBE_API_URL` en Vercel.
