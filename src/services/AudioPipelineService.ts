import { callTranslateApi, base64ToBlob } from './translateApi';
import { getSharedAudioContext, unlockAudioPlayback, playAudioBlob } from './audioUnlock';
import type {
  AudioRecorderOptions,
  PipelineEventListener,
  PipelineEventMap,
  PipelineResult,
  PipelineStatus,
} from '@/types';

const DEFAULT_RECORDER_OPTIONS: Required<AudioRecorderOptions> = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000,
};

// Orden de preferencia de MIME types para MediaRecorder. Safari iOS no soporta
// audio/webm (hasta iOS 17.x); usa audio/mp4 (AAC). Se elige el primero soportado
// en runtime via MediaRecorder.isTypeSupported.
const MIME_TYPE_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/aac',
  'audio/mpeg',
];

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }
  const supported = MIME_TYPE_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
  if (!supported) {
    console.warn('[AudioPipeline] Ningun mimeType candidato soportado, se usara el default del navegador');
  }
  return supported;
}

export interface RunTranslationOptions {
  sourceLanguage: string;
  targetLanguage: string;
  systemPrompt?: string;
  presetId?: string;
  voiceId: string;
  pitchShift?: number;
  speedMultiplier?: number;
  /** Si es false, no reproduce el audio localmente (ej. Live Room: el emisor no debe escuchar su propia traduccion). */
  autoPlay?: boolean;
}

/**
 * Servicio centralizado del Core Audio Pipeline.
 * Encapsula: captura de microfono -> STT (Deepgram) -> LLM (Gemini) -> TTS (ElevenLabs)
 * y expone una maquina de estados: IDLE -> RECORDING -> TRANSCRIBING -> TRANSLATING
 * -> SYNTHESIZING_VOICE -> PLAYING.
 */
export class AudioPipelineService {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private status: PipelineStatus = 'IDLE';
  private analyser: AnalyserNode | null = null;
  private volumeRafId: number | null = null;

  private listeners: { [K in keyof PipelineEventMap]?: Set<PipelineEventListener<K>> } = {};

  on<K extends keyof PipelineEventMap>(event: K, listener: PipelineEventListener<K>): () => void {
    const listeners = this.listeners as Record<K, Set<PipelineEventListener<K>> | undefined>;
    const set = (listeners[event] ??= new Set());
    set.add(listener);
    return () => set.delete(listener);
  }

  private emit<K extends keyof PipelineEventMap>(event: K, payload: PipelineEventMap[K]): void {
    const set = this.listeners[event] as Set<PipelineEventListener<K>> | undefined;
    set?.forEach((listener) => listener(payload));
  }

  private setStatus(status: PipelineStatus): void {
    this.status = status;
    this.emit('statuschange', status);
  }

  getStatus(): PipelineStatus {
    return this.status;
  }

  async startRecording(options: AudioRecorderOptions = {}): Promise<void> {
    if (this.status === 'RECORDING') return;

    // Debe ejecutarse de forma sincrona (antes del primer `await`) para que
    // el AudioContext se desbloquee dentro del mismo gesto de usuario que
    // origino esta llamada (pointerdown del boton de microfono) — requisito
    // de la politica de autoplay de iOS Safari. Se usa el AudioContext
    // COMPARTIDO de toda la app (audioUnlock.ts) para que la reproduccion
    // de audio asincrono ajeno (ej. mensajes de Live Room) tambien quede
    // desbloqueada.
    unlockAudioPlayback();

    const constraints = { ...DEFAULT_RECORDER_OPTIONS, ...options };
    const preferredConstraints: MediaTrackConstraints = {
      echoCancellation: constraints.echoCancellation,
      noiseSuppression: constraints.noiseSuppression,
      autoGainControl: constraints.autoGainControl,
      sampleRate: constraints.sampleRate,
    };

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: preferredConstraints });
    } catch (err) {
      console.error(
        '[AudioPipeline] getUserMedia con constraints avanzadas fallo (comun en iOS Safari), reintentando con audio:true',
        err
      );
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    this.mediaStream = stream;

    const audioTrack = stream.getAudioTracks()[0];
    console.log('[AudioPipeline] Microfono capturado:', audioTrack?.label, audioTrack?.getSettings());

    this.chunks = [];
    const mimeType = pickSupportedMimeType();
    console.log('[AudioPipeline] MediaRecorder mimeType:', mimeType ?? '(default del navegador)');
    this.mediaRecorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data);
        console.log('[AudioPipeline] chunk recibido:', e.data.size, 'bytes');
      }
    };
    this.mediaRecorder.onerror = (e) => {
      console.error('[AudioPipeline] MediaRecorder error:', e);
    };

    this.mediaRecorder.start(250);
    this.setupVolumeMeter(stream);
    this.setStatus('RECORDING');
  }

  /** Detiene la grabacion y devuelve el blob de audio capturado (sin procesar). */
  async stopRecording(): Promise<Blob> {
    if (!this.mediaRecorder || this.status !== 'RECORDING') {
      throw new Error('No hay grabacion activa');
    }

    const recorder = this.mediaRecorder;
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(this.chunks, { type: recorder.mimeType }));
      };
      recorder.stop();
    });

    console.log('[AudioPipeline] Grabacion detenida:', blob.size, 'bytes,', blob.type);
    this.teardownStream();
    this.setStatus('IDLE');
    return blob;
  }

  /**
   * Ejecuta el pipeline completo delegando STT -> LLM -> TTS a la Cloudflare
   * Pages Function `/api/translate` (edge), que mantiene las API keys fuera
   * del cliente. La funcion resuelve las 3 etapas en una sola respuesta, asi
   * que los estados intermedios se emiten en secuencia al recibirla.
   */
  async runFullPipeline(audioBlob: Blob, options: RunTranslationOptions): Promise<PipelineResult> {
    try {
      this.setStatus('TRANSCRIBING');

      const apiResult = await callTranslateApi({
        audioBlob,
        sourceLanguage: options.sourceLanguage,
        targetLanguage: options.targetLanguage,
        systemPrompt: options.systemPrompt,
        voiceId: options.voiceId,
        speedMultiplier: options.speedMultiplier,
      });

      const transcription = {
        transcript: apiResult.transcript,
        words: [],
        detectedLanguage: apiResult.detectedLanguage,
        confidence: 1,
        isFinal: true,
      };
      this.emit('transcript', transcription);

      this.setStatus('TRANSLATING');
      const translation = {
        originalText: apiResult.transcript,
        translatedText: apiResult.translatedText,
        sourceLanguage: apiResult.detectedLanguage,
        targetLanguage: options.targetLanguage,
        presetId: options.presetId,
      };
      this.emit('translation', translation);

      this.setStatus('SYNTHESIZING_VOICE');
      const audioBlobResult = base64ToBlob(apiResult.audioBase64, apiResult.mimeType);
      const synthesis = {
        audioUrl: URL.createObjectURL(audioBlobResult),
        audioBlob: audioBlobResult,
        durationMs: apiResult.durationEstimateMs,
      };
      this.emit('synthesis', synthesis);

      if (options.autoPlay !== false && apiResult.audioBase64) {
        this.setStatus('PLAYING');
        await playAudioBlob(audioBlobResult);
      }
      this.setStatus('IDLE');

      return { transcription, translation, synthesis };
    } catch (err) {
      this.setStatus('ERROR');
      const error = err instanceof Error ? err : new Error('Error desconocido en el pipeline');
      this.emit('error', error);
      throw error;
    }
  }

  private setupVolumeMeter(stream: MediaStream): void {
    const ctx = getSharedAudioContext();
    const source = ctx.createMediaStreamSource(stream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);

    const data = new Uint8Array(this.analyser.frequencyBinCount);
    const tick = () => {
      if (!this.analyser) return;
      this.analyser.getByteFrequencyData(data);
      const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
      this.emit('volume', avg / 255);
      this.volumeRafId = requestAnimationFrame(tick);
    };
    tick();
  }

  private teardownStream(): void {
    if (this.volumeRafId !== null) {
      cancelAnimationFrame(this.volumeRafId);
      this.volumeRafId = null;
    }
    this.analyser = null;
    // El AudioContext compartido (audioUnlock.ts) NO se cierra aqui: vive a
    // nivel de app y se reutiliza para reproducir audio ajeno (Live Room)
    // que puede llegar en cualquier momento, sin depender de un nuevo gesto.
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;
    this.mediaRecorder = null;
  }

  dispose(): void {
    this.teardownStream();
    this.listeners = {};
  }
}
