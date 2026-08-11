import { useCallback, useState } from 'react';
import { useAudioPipelineContext } from '@/context/AudioPipelineContext';
import type { AudioRecorderOptions } from '@/types';

/**
 * Hook de bajo nivel: solo captura audio (echo cancellation + noise suppression)
 * y devuelve el blob crudo. Util cuando no se necesita el pipeline de traduccion
 * completo (ej. Clip Studio extrayendo audio de un video, o pruebas manuales).
 */
export function useAudioRecorder(options?: AudioRecorderOptions) {
  const { service, status, volume } = useAudioPipelineContext();
  const [isRecording, setIsRecording] = useState(false);

  const start = useCallback(async () => {
    await service.startRecording(options);
    setIsRecording(true);
  }, [service, options]);

  const stop = useCallback(async () => {
    const blob = await service.stopRecording();
    setIsRecording(false);
    return blob;
  }, [service]);

  return { start, stop, isRecording, status, volume };
}
