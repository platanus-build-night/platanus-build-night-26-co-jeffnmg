// Conversión de audio del navegador (mp3/webm/m4a/wav…) a WAV mono
// 22050 Hz PCM 16-bit: el formato que consume Basic Pitch en el backend.
// El audio se normaliza (peak) para que grabaciones flojas de micrófono
// lleguen con nivel suficiente al detector de notas.

const TARGET_SAMPLE_RATE = 22050;
const NORMALIZE_PEAK = 0.95;

export async function blobToMonoWav(blob: Blob): Promise<Blob> {
  const bytes = await blob.arrayBuffer();

  // Decodificar con el contexto normal (soporta todos los códecs del browser)
  const decodeCtx = new AudioContext();
  const decoded = await decodeCtx.decodeAudioData(bytes);
  await decodeCtx.close();

  // Re-muestrear a mono 22050 Hz con un contexto offline
  const frames = Math.ceil(decoded.duration * TARGET_SAMPLE_RATE);
  const offline = new OfflineAudioContext(1, frames, TARGET_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();

  const samples = rendered.getChannelData(0);
  normalizePeak(samples);
  return encodePcm16Wav(samples, TARGET_SAMPLE_RATE);
}

/**
 * Normalización de pico in-place: sube (o baja) la ganancia para que el pico
 * quede en NORMALIZE_PEAK. Se omite si el audio es prácticamente silencio,
 * para no amplificar puro ruido de fondo.
 */
function normalizePeak(samples: Float32Array, target = NORMALIZE_PEAK): void {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
  }
  if (peak < 1e-3) return; // silencio: amplificar solo metería ruido
  const gain = target / peak;
  if (Math.abs(gain - 1) < 0.01) return;
  for (let i = 0; i < samples.length; i++) {
    samples[i] *= gain;
  }
}

function encodePcm16Wav(samples: Float32Array, sampleRate: number): Blob {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  // Cabecera RIFF/WAVE (PCM mono 16-bit)
  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // formato PCM
  view.setUint16(22, 1, true); // 1 canal
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits por muestra
  ascii(36, "data");
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const clamped = Math.min(1, Math.max(-1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}
