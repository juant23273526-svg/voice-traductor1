import { useEffect, useState } from 'react';
import { extractAudioFromVideo } from '@/services/FFmpegService';
import { callTranslateApi, base64ToBlob } from '@/services/translateApi';
import { buildWordCues } from '@/utils/subtitles';
import { getAudioDurationMs } from '@/utils/media';
import { useSimulatedVolume } from '@/hooks/useSimulatedVolume';
import { StageChecklist, type StageItem } from '@/components/shared/StageChecklist';
import { WaveformVisualizer } from '@/components/shared/WaveformVisualizer';
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

// El backend resuelve STT+LLM+TTS en UNA sola llamada de red (`translating`),
// asi que no hay eventos reales entre "transcribiendo" y "traduciendo" — se
// simula ese sub-avance con un timer local (solo cosmetico, no altera
// /api/translate ni el tiempo real de espera) para mostrar las 4 etapas que
// el usuario espera ver: Extrayendo -> Transcribiendo -> Traduciendo -> Sintetizando.
const FLAT_STEPS = ['extracting', 'transcribing', 'translating', 'synthesizing'] as const;
type FlatStep = (typeof FLAT_STEPS)[number];

const FLAT_LABELS: Record<FlatStep, string> = {
  extracting: 'Extrayendo audio del video',
  transcribing: 'Transcribiendo tu voz',
  translating: 'Traduciendo con IA',
  synthesizing: 'Generando la voz doblada',
};

function currentFlatStep(step: Step, translateSubStage: number): FlatStep {
  if (step === 'extracting') return 'extracting';
  if (step === 'translating') return translateSubStage === 0 ? 'transcribing' : 'translating';
  return 'synthesizing';
}

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
  const [translateSubStage, setTranslateSubStage] = useState(0);
  const waveformVolume = useSimulatedVolume(step !== 'done');

  useEffect(() => {
    if (step !== 'translating') {
      setTranslateSubStage(0);
      return;
    }
    const timeout = setTimeout(() => setTranslateSubStage(1), 1400);
    return () => clearTimeout(timeout);
  }, [step]);

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
        // Se usa la duracion real del audio decodificado (mas precisa que la
        // estimacion heuristica del backend) para sincronizar los subtitulos.
        const realDurationMs = await getAudioDurationMs(audioBlobResult);
        const synthesis: SynthesisResult = {
          audioUrl: URL.createObjectURL(audioBlobResult),
          audioBlob: audioBlobResult,
          durationMs: realDurationMs || apiResult.durationEstimateMs,
        };
        if (cancelled) return;
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

  const current = currentFlatStep(step, translateSubStage);
  const currentIndex = FLAT_STEPS.indexOf(current);
  const items: StageItem[] = FLAT_STEPS.map((flatStep, i) => ({
    id: flatStep,
    label: FLAT_LABELS[flatStep],
    state: step === 'done' || i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'pending',
  }));

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <WaveformVisualizer volume={waveformVolume} active={step !== 'done'} barColor="#818cf8" className="w-full" />
      <StageChecklist items={items} />
    </div>
  );
}
