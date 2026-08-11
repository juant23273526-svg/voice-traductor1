import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { extractAudioFromVideo } from '@/services/FFmpegService';
import { callTranslateApi, base64ToBlob } from '@/services/translateApi';
import { buildWordCues } from '@/utils/subtitles';
import type { TranslationResult, SynthesisResult, WordTimestamp } from '@/types';

export interface DubbingOutput {
  translation: TranslationResult;
  synthesis: SynthesisResult;
  wordCues: WordTimestamp[];
}

interface DubbingProcessorProps {
  videoFile: File;
  sourceLanguageCode: string;
  targetLanguageCode: string;
  voiceId: string;
  onComplete: (output: DubbingOutput) => void;
  onError: (error: Error) => void;
}

type Step = 'extracting' | 'translating' | 'synthesizing' | 'done';

const STEP_LABELS: Record<Step, string> = {
  extracting: 'Extrayendo audio del video...',
  translating: 'Transcribiendo y traduciendo (edge)...',
  synthesizing: 'Clonando voz y generando doblaje...',
  done: 'Doblaje listo',
};

const STEP_ORDER: Step[] = ['extracting', 'translating', 'synthesizing', 'done'];

/**
 * Orquesta el pipeline de doblaje sintetico para Clip Studio:
 * extraccion de audio (FFmpeg.wasm, cliente) -> STT/LLM/TTS via
 * `/api/translate` (Cloudflare Pages Function, edge).
 */
export function DubbingProcessor({
  videoFile,
  sourceLanguageCode,
  targetLanguageCode,
  voiceId,
  onComplete,
  onError,
}: DubbingProcessorProps) {
  const [step, setStep] = useState<Step>('extracting');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setStep('extracting');
        const audioBlob = await extractAudioFromVideo(videoFile);
        if (cancelled) return;

        setStep('translating');
        const apiResult = await callTranslateApi({
          audioBlob,
          sourceLanguage: sourceLanguageCode,
          targetLanguage: targetLanguageCode,
          voiceId,
        });
        if (cancelled) return;

        setStep('synthesizing');
        const audioBlobResult = base64ToBlob(apiResult.audioBase64, apiResult.mimeType);
        const synthesis: SynthesisResult = {
          audioUrl: URL.createObjectURL(audioBlobResult),
          audioBlob: audioBlobResult,
          durationMs: apiResult.durationEstimateMs,
        };
        const translation: TranslationResult = {
          originalText: apiResult.transcript,
          translatedText: apiResult.translatedText,
          sourceLanguage: apiResult.detectedLanguage,
          targetLanguage: targetLanguageCode,
        };
        const wordCues = buildWordCues(translation.translatedText, synthesis.durationMs);

        setStep('done');
        onComplete({ translation, synthesis, wordCues });
      } catch (err) {
        if (!cancelled) onError(err instanceof Error ? err : new Error('Error en el doblaje'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [videoFile, sourceLanguageCode, targetLanguageCode, voiceId, onComplete, onError]);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      {STEP_ORDER.map((s) => {
        const currentIndex = STEP_ORDER.indexOf(step);
        const stepIndex = STEP_ORDER.indexOf(s);
        const isDone = stepIndex < currentIndex || step === 'done';
        const isActive = s === step && step !== 'done';

        return (
          <div key={s} className="flex items-center gap-3 text-sm">
            {isDone ? (
              <CheckCircle2 size={16} className="text-emerald-400" />
            ) : isActive ? (
              <Loader2 size={16} className="animate-spin text-indigo-400" />
            ) : (
              <span className="h-4 w-4 rounded-full border border-slate-700" />
            )}
            <span className={isDone ? 'text-slate-300' : isActive ? 'text-slate-100' : 'text-slate-600'}>
              {STEP_LABELS[s]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
