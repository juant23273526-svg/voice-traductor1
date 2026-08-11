import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type { SubtitleStyle } from '@/types/clipstudio';

const CORE_BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

/**
 * Carga FFmpeg.wasm en el cliente (una sola vez, cacheado en memoria).
 * Se usa para extraer audio de video y para combinar video + audio doblado +
 * subtitulos sin tocar ningun servidor (Modulo 3: Clip Studio).
 */
export async function loadFFmpeg(onProgress?: (ratio: number) => void): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();

    if (onProgress) {
      ffmpeg.on('progress', ({ progress }) => onProgress(Math.min(1, Math.max(0, progress))));
    }

    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return loadPromise;
}

// Debe coincidir con el umbral del backend (functions/api/translate.ts) y de
// AudioPipelineService.ts: por debajo de esto no hay señal aprovechable para
// STT y es mejor fallar aqui, con un mensaje claro, que gastar la llamada
// completa a /api/translate para terminar en el mismo error.
const MIN_AUDIO_BYTES = 2000;

/** Extrae el audio de un archivo de video como .wav (PCM, tipo MIME explicito) para el pipeline STT/TTS. */
export async function extractAudioFromVideo(videoFile: File): Promise<Blob> {
  const ffmpeg = await loadFFmpeg();
  const inputName = 'input' + getExtension(videoFile.name);
  const outputName = 'extracted-audio.wav';

  console.log('[FFmpegService] Extrayendo audio de', videoFile.name, videoFile.type, videoFile.size, 'bytes');

  await ffmpeg.writeFile(inputName, await fetchFile(videoFile));
  // 16kHz mono 16-bit PCM: suficiente calidad para STT (Deepgram recomienda
  // 16kHz para voz) y reduce el Blob resultante a una fraccion del tamaño
  // que daria 44.1kHz estereo — clave para no acercarse al limite de payload
  // de Cloudflare Pages Functions y para que el upload sea practicamente
  // instantaneo.
  await ffmpeg.exec(['-i', inputName, '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', outputName]);
  const data = await ffmpeg.readFile(outputName);

  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  // Siempre se etiqueta con un MIME type explicito (audio/wav): el pipeline
  // de traduccion (callTranslateApi -> Deepgram) depende de blob.type para
  // fijar el Content-Type real, nunca debe llegar como blob generico.
  const audioBlob = new Blob([data as Uint8Array<ArrayBuffer>], { type: 'audio/wav' });
  console.log('[FFmpegService] Audio extraido:', audioBlob.size, 'bytes,', audioBlob.type);

  if (audioBlob.size < MIN_AUDIO_BYTES) {
    console.error('[FFmpegService] El audio extraido es demasiado pequeño/vacio:', audioBlob.size, 'bytes');
    throw new Error('El video no contiene una pista de audio aprovechable (silencio o sin audio). Prueba con otro clip.');
  }

  return audioBlob;
}

interface ExportClipOptions {
  videoFile: File;
  dubbedAudioBlob: Blob;
  srtContent?: string;
  subtitleStyle?: SubtitleStyle;
  onProgress?: (ratio: number) => void;
}

/** Convierte un color hex (#RRGGBB) al formato ASS/SSA &H00BBGGRR usado por libass. */
function hexToAssColor(hex: string): string {
  const clean = hex.replace('#', '');
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

/** Alineacion numpad de ASS/SSA: 2=abajo-centro, 5=centro-centro, 8=arriba-centro. */
function assAlignmentFor(position: SubtitleStyle['position']): number {
  if (position === 'top') return 8;
  if (position === 'middle') return 5;
  return 2;
}

function buildForceStyle(style: SubtitleStyle): string {
  const fontName = style.fontFamily.split(',')[0].replace(/["']/g, '').trim() || 'Arial';
  return [
    `FontName=${fontName}`,
    'FontSize=18',
    `PrimaryColour=${hexToAssColor(style.highlightColor)}`,
    'OutlineColour=&H00020617',
    'BorderStyle=1',
    'Outline=1.4',
    `Alignment=${assAlignmentFor(style.position)}`,
  ].join(',');
}

/**
 * Combina el video original (sin su audio) con el audio doblado sintetizado,
 * y opcionalmente quema subtitulos .srt sobre el video. Devuelve un .mp4 final.
 */
export async function exportDubbedClip({
  videoFile,
  dubbedAudioBlob,
  srtContent,
  subtitleStyle,
  onProgress,
}: ExportClipOptions): Promise<Blob> {
  const ffmpeg = await loadFFmpeg(onProgress);
  const videoInput = 'source' + getExtension(videoFile.name);
  const audioInput = 'dubbed.wav';
  const subsInput = 'subs.srt';
  const output = 'output.mp4';

  await ffmpeg.writeFile(videoInput, await fetchFile(videoFile));
  await ffmpeg.writeFile(audioInput, await fetchFile(dubbedAudioBlob));

  const filterArgs: string[] = [];
  if (srtContent) {
    await ffmpeg.writeFile(subsInput, srtContent);
    const forceStyle = buildForceStyle(subtitleStyle ?? { highlightColor: '#10b981', fontFamily: 'Arial', position: 'bottom' });
    filterArgs.push('-vf', `subtitles=${subsInput}:force_style='${forceStyle}'`);
  }

  await ffmpeg.exec([
    '-i', videoInput,
    '-i', audioInput,
    ...filterArgs,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', filterArgs.length ? 'libx264' : 'copy',
    '-c:a', 'aac',
    '-shortest',
    output,
  ]);

  const data = await ffmpeg.readFile(output);

  await ffmpeg.deleteFile(videoInput);
  await ffmpeg.deleteFile(audioInput);
  if (srtContent) await ffmpeg.deleteFile(subsInput);
  await ffmpeg.deleteFile(output);

  return new Blob([data as Uint8Array<ArrayBuffer>], { type: 'video/mp4' });
}

function getExtension(filename: string): string {
  const match = filename.match(/\.[^.]+$/);
  return match ? match[0] : '.mp4';
}
