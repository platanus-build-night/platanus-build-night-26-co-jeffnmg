"""Genera un WAV de prueba: melodía C4-E4-G4-C5 (senos, 0.5s por nota).

Uso: python make_test_wav.py [salida.wav]
"""

import math
import struct
import sys
import wave

SAMPLE_RATE = 22050
NOTES_HZ = [261.63, 329.63, 392.00, 523.25]  # C4 E4 G4 C5
NOTE_SEC = 0.5


def main(path: str = "test_melody.wav") -> None:
    frames = bytearray()
    for hz in NOTES_HZ:
        n = int(SAMPLE_RATE * NOTE_SEC)
        for i in range(n):
            t = i / SAMPLE_RATE
            # Envolvente simple para evitar clicks entre notas
            env = min(1.0, i / 500, (n - i) / 500)
            # Fundamental + un poco de segundo armónico para que parezca voz/instrumento
            sample = 0.6 * math.sin(2 * math.pi * hz * t) + 0.2 * math.sin(
                4 * math.pi * hz * t
            )
            frames += struct.pack("<h", int(sample * env * 32767 * 0.8))

    with wave.open(path, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SAMPLE_RATE)
        f.writeframes(bytes(frames))
    print(f"OK {path}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "test_melody.wav")
