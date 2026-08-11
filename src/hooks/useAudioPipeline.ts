import { useCallback, useState } from 'react';
import { useAudioPipelineContext } from '@/context/AudioPipelineContext';
import type { PipelineResult } from '@/types';
import type { RunTranslationOptions } from '@/services/AudioPipelineService';

/**
 * Hook de conveniencia para el flujo "hold-to-talk": empieza a grabar al
 * presionar, y al soltar corre el pipeline completo (STT -> LLM -> TTS -> play).
 */
export function useAudioPipeline() {
  const { service, status, volume, lastTranscription, lastTranslation, lastSynthesis, lastError } =
    useAudioPipelineContext();
  const [isHolding, setIsHolding] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);

  const startHold = useCallback(async () => {
    setIsHolding(true);
    await service.startRecording();
  }, [service]);

  const endHold = useCallback(
    async (options: RunTranslationOptions) => {
      setIsHolding(false);
      const blob = await service.stopRecording();
      const pipelineResult = await service.runFullPipeline(blob, options);
      setResult(pipelineResult);
      return pipelineResult;
    },
    [service]
  );

  const cancelHold = useCallback(async () => {
    setIsHolding(false);
    try {
      await service.stopRecording();
    } catch {
      // no habia grabacion activa, ignorar
    }
  }, [service]);

  return {
    status,
    volume,
    isHolding,
    result,
    lastTranscription,
    lastTranslation,
    lastSynthesis,
    lastError,
    startHold,
    endHold,
    cancelHold,
  };
}
