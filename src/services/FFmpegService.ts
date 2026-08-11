import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

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

/** Extrae el audio de un archivo de video como .wav para enviarlo al pipeline STT/TTS. */
export async function extractAudioFromVideo(videoFile: File): Promise<Blob> {
  const ffmpeg = await loadFFmpeg();
  const inputName = 'input' + getExtension(videoFile.name);
  const outputName = 'extracted-audio.wav';

  await ffmpeg.writeFile(inputName, await fetchFile(videoFile));
  await ffmpeg.exec(['-i', inputName, '-vn', '-acodec', 'pcm_s16le', '-ar', '44100', outputName]);
  const data = await ffmpeg.readFile(outputName);

  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  return new Blob([data as Uint8Array<ArrayBuffer>], { type: 'audio/wav' });
}

interface ExportClipOptions {
  videoFile: File;
  dubbedAudioBlob: Blob;
  srtContent?: string;
  onProgress?: (ratio: number) => void;
}

/**
 * Combina el video original (sin su audio) con el audio doblado sintetizado,
 * y opcionalmente quema subtitulos .srt sobre el video. Devuelve un .mp4 final.
 */
export async function exportDubbedClip({
  videoFile,
  dubbedAudioBlob,
  srtContent,
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
    filterArgs.push('-vf', `subtitles=${subsInput}:force_style='FontSize=18,PrimaryColour=&H00E2FFD1'`);
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
