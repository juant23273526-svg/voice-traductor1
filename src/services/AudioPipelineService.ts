import { callTranslateApi, base64ToBlob } from './translateApi';
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
  private audioContext: AudioContext | null = null;
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

    const constraints = { ...DEFAULT_RECORDER_OPTIONS, ...options };

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: constraints.echoCancellation,
        noiseSuppression: constraints.noiseSuppression,
        autoGainControl: constraints.autoGainControl,
        sampleRate: constraints.sampleRate,
      },
    });

    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.mediaStream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm',
    });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.start(250);
    this.setupVolumeMeter(this.mediaStream);
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
        await this.playAudio(synthesis.audioUrl);
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

  private playAudio(audioUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(audioUrl);
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error('Error reproduciendo audio sintetizado'));
      void audio.play();
    });
  }

  private setupVolumeMeter(stream: MediaStream): void {
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(stream);
    this.analyser = this.audioContext.createAnalyser();
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
    void this.audioContext?.close();
    this.audioContext = null;
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;
    this.mediaRecorder = null;
  }

  dispose(): void {
    this.teardownStream();
    this.listeners = {};
  }
}
