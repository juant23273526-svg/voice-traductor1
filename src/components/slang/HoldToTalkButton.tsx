import { Mic } from 'lucide-react';
import clsx from 'clsx';

interface HoldToTalkButtonProps {
  isHolding: boolean;
  disabled?: boolean;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  onHoldCancel: () => void;
}

/**
 * Boton "Hold-to-Talk" estilo nota de voz de WhatsApp.
 * Soporta mouse y touch: mantener presionado graba, soltar procesa,
 * deslizar fuera del boton cancela (igual que WhatsApp).
 */
export function HoldToTalkButton({
  isHolding,
  disabled,
  onHoldStart,
  onHoldEnd,
  onHoldCancel,
}: HoldToTalkButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        if (!disabled) onHoldStart();
      }}
      onPointerUp={() => {
        if (isHolding) onHoldEnd();
      }}
      onPointerLeave={() => {
        if (isHolding) onHoldCancel();
      }}
      onPointerCancel={() => {
        if (isHolding) onHoldCancel();
      }}
      className={clsx(
        'relative flex h-20 w-20 select-none items-center justify-center rounded-full transition-transform active:scale-95',
        'touch-none disabled:cursor-not-allowed disabled:opacity-40',
        isHolding
          ? 'bg-gradient-to-br from-rose-500 to-rose-600 shadow-xl shadow-rose-500/40'
          : 'bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-xl shadow-indigo-500/30'
      )}
    >
      {isHolding && (
        <span className="absolute inset-0 rounded-full bg-rose-500/60 animate-pulse-ring" />
      )}
      <Mic size={30} className="relative text-white" strokeWidth={2.25} />
    </button>
  );
}
