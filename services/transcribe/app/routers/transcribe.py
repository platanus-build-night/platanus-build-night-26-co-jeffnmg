"""Audio → notas crudas.

Basic Pitch (Spotify) hace la detección de pitch; librosa estima el tempo.
Ambas dependencias son opcionales: sin ellas el servicio responde /status
con los faltantes para que la UI muestre un mensaje claro.
"""

import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile

router = APIRouter()

try:
    from basic_pitch import ICASSP_2022_MODEL_PATH  # type: ignore
    from basic_pitch.inference import predict  # type: ignore

    BASIC_PITCH_OK = True
except ImportError:
    BASIC_PITCH_OK = False

try:
    import librosa  # type: ignore

    LIBROSA_OK = True
except ImportError:
    LIBROSA_OK = False


@router.get("/status")
def status() -> dict:
    """Qué capacidades tiene esta instancia del servicio."""
    return {
        "basicPitch": BASIC_PITCH_OK,
        "tempoDetection": LIBROSA_OK,
        "hint": None
        if BASIC_PITCH_OK
        else "Faltan los modelos: pip install -r requirements.txt",
    }


@router.post("/notes")
async def notes(file: UploadFile) -> dict:
    """Devuelve {notes: [{midi, startSec, durationSec, velocity}], bpm}."""
    if not BASIC_PITCH_OK:
        raise HTTPException(
            status_code=501,
            detail="Basic Pitch no está instalado en el servicio de transcripción.",
        )

    suffix = Path(file.filename or "audio.wav").suffix or ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        _model_output, _midi_data, note_events = predict(tmp_path, ICASSP_2022_MODEL_PATH)

        detected = [
            {
                "midi": int(round(pitch)),
                "startSec": float(start),
                "durationSec": float(end - start),
                "velocity": float(amplitude),
            }
            for start, end, pitch, amplitude, _pitch_bends in note_events
        ]
        detected.sort(key=lambda n: n["startSec"])

        bpm = None
        if LIBROSA_OK:
            samples, sample_rate = librosa.load(tmp_path, sr=22050, mono=True)
            tempo, _beats = librosa.beat.beat_track(y=samples, sr=sample_rate)
            bpm = float(tempo) if tempo else None

        return {"notes": detected, "bpm": bpm}
    finally:
        Path(tmp_path).unlink(missing_ok=True)
