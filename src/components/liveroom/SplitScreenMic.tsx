import { Mic, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import type { LanguageOption } from '@/constants/languages';
import type { PipelineStatus } from '@/types';

interface SplitScreenMicProps {
  ownLanguage: LanguageOption;
  peerLanguage: LanguageOption;
  status: PipelineStatus;
  activeSide: 'own' | 'peer' | null;
  onPressStart: (side: 'own' | 'peer') => void;
  onPressEnd: (side: 'own' | 'peer') => void;
}

/**
 * Interfaz "walkie-talkie": dos botones grandes de microfono, uno por idioma.
 * Sirve tanto para conversacion cara a cara en un mismo telefono (split-screen)
 * como para indicar en que idioma se esta hablando dentro de una Live Room remota.
 */
export function SplitScreenMic({
  ownLanguage,
  peerLanguage,
  status,
  activeSide,
  onPressStart,
  onPressEnd,
}: SplitScreenMicProps) {
  const busy = status !== 'IDLE';

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <MicHalf
        language={ownLanguage}
        colorClass="from-indigo-500 to-indigo-600 shadow-indigo-500/30"
        isActive={activeSide === 'own'}
        disabled={busy && activeSide !== 'own'}
        onPressStart={() => onPressStart('own')}
        onPressEnd={() => onPressEnd('own')}
      />
      <MicHalf
        language={peerLanguage}
        colorClass="from-emerald-500 to-emerald-600 shadow-emerald-500/30"
        isActive={activeSide === 'peer'}
        disabled={busy && activeSide !== 'peer'}
        onPressStart={() => onPressStart('peer')}
        onPressEnd={() => onPressEnd('peer')}
      />
      {status !== 'IDLE' && activeSide && (
        <div className="col-span-full flex items-center justify-center gap-2 text-xs text-slate-400">
          <Loader2 size={14} className="animate-spin" />
          Procesando...
        </div>
      )}
    </div>
  );
}

function MicHalf({
  language,
  colorClass,
  isActive,
  disabled,
  onPressStart,
  onPressEnd,
}: {
  language: LanguageOption;
  colorClass: string;
  isActive: boolean;
  disabled: boolean;
  onPressStart: () => void;
  onPressEnd: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        if (!disabled) onPressStart();
      }}
      onPointerUp={() => isActive && onPressEnd()}
      onPointerLeave={() => isActive && onPressEnd()}
      onPointerCancel={() => isActive && onPressEnd()}
      className={clsx(
        'flex touch-none select-none flex-col items-center justify-center gap-3 rounded-3xl bg-gradient-to-br p-8 text-white transition-transform active:scale-[0.98]',
        colorClass,
        disabled && 'opacity-40'
      )}
    >
      <span className="text-4xl">{language.flagEmoji}</span>
      <Mic size={28} />
      <span className="text-sm font-semibold">Hablar en {language.label}</span>
    </button>
  );
}
