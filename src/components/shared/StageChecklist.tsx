import { Check } from 'lucide-react';
import clsx from 'clsx';

export interface StageItem {
  id: string;
  label: string;
  state: 'pending' | 'active' | 'done';
}

interface StageChecklistProps {
  items: StageItem[];
  className?: string;
}

/**
 * Lista generica de etapas con transiciones CSS fluidas (sin spinners
 * bloqueantes): cada item anima su icono/color al pasar de pending -> active
 * -> done. Usado tanto por ProcessingStages (Slang/Live Room) como por
 * DubbingProcessor (Clip Studio) para compartir el mismo lenguaje visual.
 */
export function StageChecklist({ items, className }: StageChecklistProps) {
  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 text-sm">
          <span
            className={clsx(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-300',
              item.state === 'done' && 'border-emerald-500 bg-emerald-500/20 text-emerald-400',
              item.state === 'active' && 'scale-110 border-indigo-400 bg-indigo-400/10 text-indigo-300',
              item.state === 'pending' && 'border-slate-700 text-slate-600'
            )}
          >
            {item.state === 'done' ? (
              <Check size={12} />
            ) : (
              <span className={clsx('h-1.5 w-1.5 rounded-full bg-current', item.state === 'active' && 'animate-pulse')} />
            )}
          </span>
          <span
            className={clsx(
              'transition-colors duration-300',
              item.state === 'done' && 'text-slate-400',
              item.state === 'active' && 'font-medium text-slate-100',
              item.state === 'pending' && 'text-slate-600'
            )}
          >
            {item.label}
            {item.state === 'active' && <span className="animate-pulse">...</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
