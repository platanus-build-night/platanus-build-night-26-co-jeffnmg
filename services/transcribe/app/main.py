"""Servicio de transcripción de JamRoom.

Recibe audio y devuelve notas crudas (Basic Pitch) + BPM estimado (librosa).
La app Next.js le habla a través de su propio proxy, así que CORS abierto
está bien para desarrollo; en producción el proxy es el único cliente.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import transcribe

app = FastAPI(title="JamRoom Transcribe", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transcribe.router, prefix="/api/transcribe", tags=["transcribe"])


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
