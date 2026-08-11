import { useEffect, useState } from 'react';
import { StageChecklist, type StageItem } from './StageChecklist';
import type { PipelineStatus } from '@/types';

const STAGE_LABELS = ['Transcribiendo tu voz', 'Traduciendo con IA', 'Generando la voz doblada'];

interface ProcessingStagesProps {
  status: PipelineStatus;
  className?: string;
}

/**
 * Indicador de progreso fluido por etapas para el pipeline cloud
 * (Deepgram -> Gemini -> ElevenLabs). El backend resuelve las 3 etapas en
 * UNA sola llamada a `/api/translate`, asi que no hay eventos reales de
 * progreso intermedio — mientras el pipeline esta en TRANSCRIBING (el unico
 * estado con espera real de red) se simula el avance visual entre las 3
 * etiquetas cada ~1.3s, dando percepcion de progreso en vez de un spinner
 * estatico. En cuanto la respuesta real llega, el estado salta directo a
 * TRANSLATING/SYNTHESIZING_VOICE/PLAYING y el indicador se sincroniza al
 * instante — nunca miente sobre si el trabajo ya termino.
 */
export function ProcessingStages({ status, className }: ProcessingStagesProps) {
  const [simulatedStage, setSimulatedStage] = useState(0);

  useEffect(() => {
    if (status !== 'TRANSCRIBING') {
      setSimulatedStage(0);
      return;
    }
    const interval = setInterval(() => {
      setSimulatedStage((i) => Math.min(i + 1, STAGE_LABELS.length - 1));
    }, 1300);
    return () => clearInterval(interval);
  }, [status]);

  const isBusy = status === 'TRANSCRIBING' || status === 'TRANSLATING' || status === 'SYNTHESIZING_VOICE';
  if (!isBusy) return null;

  const activeIndex = status === 'SYNTHESIZING_VOICE' ? 2 : status === 'TRANSLATING' ? 1 : simulatedStage;

  const items: StageItem[] = STAGE_LABELS.map((label, i) => ({
    id: label,
    label,
    state: i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending',
  }));

  return <StageChecklist items={items} className={className} />;
}
