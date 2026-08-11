import {
  SUBTITLE_COLOR_OPTIONS,
  SUBTITLE_FONT_OPTIONS,
  SUBTITLE_POSITION_OPTIONS,
  type SubtitleStyle,
} from '@/types/clipstudio';
import clsx from 'clsx';

interface SubtitleStyleSelectorProps {
  value: SubtitleStyle;
  onChange: (style: SubtitleStyle) => void;
}

/** Panel de edicion de estilo de subtitulos: color de resalte, fuente y posicion. */
export function SubtitleStyleSelector({ value, onChange }: SubtitleStyleSelectorProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estilo de subtitulos</p>

      <div>
        <p className="mb-2 text-xs text-slate-400">Color de resalte</p>
        <div className="flex gap-2">
          {SUBTITLE_COLOR_OPTIONS.map((color) => (
            <button
              key={color.value}
              type="button"
              title={color.label}
              onClick={() => onChange({ ...value, highlightColor: color.value })}
              className={clsx(
                'h-8 w-8 rounded-full border-2 transition',
                value.highlightColor === color.value ? 'border-white scale-110' : 'border-transparent'
              )}
              style={{ backgroundColor: color.value }}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs text-slate-400">Fuente</p>
        <div className="grid grid-cols-2 gap-2">
          {SUBTITLE_FONT_OPTIONS.map((font) => (
            <button
              key={font.value}
              type="button"
              onClick={() => onChange({ ...value, fontFamily: font.value })}
              style={{ fontFamily: font.value }}
              className={clsx(
                'rounded-xl border px-3 py-2 text-sm transition',
                value.fontFamily === font.value
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600'
              )}
            >
              {font.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs text-slate-400">Posicion</p>
        <div className="grid grid-cols-3 gap-2">
          {SUBTITLE_POSITION_OPTIONS.map((pos) => (
            <button
              key={pos.value}
              type="button"
              onClick={() => onChange({ ...value, position: pos.value })}
              className={clsx(
                'rounded-xl border px-3 py-2 text-sm transition',
                value.position === pos.value
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600'
              )}
            >
              {pos.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
