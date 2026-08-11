export type PipelineStatus =
  | 'IDLE'
  | 'RECORDING'
  | 'TRANSCRIBING'
  | 'TRANSLATING'
  | 'SYNTHESIZING_VOICE'
  | 'PLAYING'
  | 'ERROR';

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface TranscriptionResult {
  transcript: string;
  words: WordTimestamp[];
  detectedLanguage: string;
  confidence: number;
  isFinal: boolean;
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  presetId?: string;
}

export interface SynthesisResult {
  audioUrl: string;
  audioBlob: Blob;
  durationMs: number;
  words?: WordTimestamp[];
}

export interface PipelineResult {
  transcription: TranscriptionResult;
  translation: TranslationResult;
  synthesis: SynthesisResult;
}

export interface AudioRecorderOptions {
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  sampleRate?: number;
}

export type PipelineEventMap = {
  statuschange: PipelineStatus;
  transcript: TranscriptionResult;
  translation: TranslationResult;
  synthesis: SynthesisResult;
  error: Error;
  volume: number;
};

export type PipelineEventListener<K extends keyof PipelineEventMap> = (
  payload: PipelineEventMap[K]
) => void;
