import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AudioPipelineService } from '@/services/AudioPipelineService';
import type { PipelineStatus, SynthesisResult, TranscriptionResult, TranslationResult } from '@/types';

interface AudioPipelineContextValue {
  service: AudioPipelineService;
  status: PipelineStatus;
  volume: number;
  lastTranscription: TranscriptionResult | null;
  lastTranslation: TranslationResult | null;
  lastSynthesis: SynthesisResult | null;
  lastError: Error | null;
}

const AudioPipelineContext = createContext<AudioPipelineContextValue | null>(null);

export function AudioPipelineProvider({ children }: { children: ReactNode }) {
  const serviceRef = useRef<AudioPipelineService>();
  if (!serviceRef.current) serviceRef.current = new AudioPipelineService();
  const service = serviceRef.current;

  const [status, setStatus] = useState<PipelineStatus>('IDLE');
  const [volume, setVolume] = useState(0);
  const [lastTranscription, setLastTranscription] = useState<TranscriptionResult | null>(null);
  const [lastTranslation, setLastTranslation] = useState<TranslationResult | null>(null);
  const [lastSynthesis, setLastSynthesis] = useState<SynthesisResult | null>(null);
  const [lastError, setLastError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribers = [
      service.on('statuschange', setStatus),
      service.on('volume', setVolume),
      service.on('transcript', setLastTranscription),
      service.on('translation', setLastTranslation),
      service.on('synthesis', setLastSynthesis),
      service.on('error', setLastError),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [service]);

  useEffect(() => () => service.dispose(), [service]);

  const value = useMemo<AudioPipelineContextValue>(
    () => ({ service, status, volume, lastTranscription, lastTranslation, lastSynthesis, lastError }),
    [service, status, volume, lastTranscription, lastTranslation, lastSynthesis, lastError]
  );

  return <AudioPipelineContext.Provider value={value}>{children}</AudioPipelineContext.Provider>;
}

export function useAudioPipelineContext(): AudioPipelineContextValue {
  const ctx = useContext(AudioPipelineContext);
  if (!ctx) throw new Error('useAudioPipelineContext debe usarse dentro de AudioPipelineProvider');
  return ctx;
}
