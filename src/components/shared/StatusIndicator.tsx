import { Loader2, Mic, Languages, AudioWaveform, Volume2 } from 'lucide-react';
import type { PipelineStatus } from '@/types';

const STATUS_CONFIG: Record<PipelineStatus, { label: string; icon: typeof Mic }> = {
  IDLE: { label: 'Listo', icon: Mic },
  RECORDING: { label: 'Escuchando...', icon: Mic },
  TRANSCRIBING: { label: 'Transcribiendo...', icon: Loader2 },
  TRANSLATING: { label: 'Adaptando jerga...', icon: Languages },
  SYNTHESIZING_VOICE: { label: 'Generando voz...', icon: AudioWaveform },
  PLAYING: { label: 'Reproduciendo...', icon: Volume2 },
  ERROR: { label: 'Ocurrio un error', icon: Loader2 },
};

export function StatusIndicator({ status }: { status: PipelineStatus }) {
  const { label, icon: Icon } = STATUS_CONFIG[status];
  const isBusy = status !== 'IDLE' && status !== 'ERROR';

  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <Icon size={16} className={isBusy ? 'animate-spin' : ''} />
      <span>{label}</span>
    </div>
  );
}
