import clsx from 'clsx';
import { CULTURAL_PRESETS } from '@/constants/culturalPresets';

interface PresetSelectorProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

export function PresetSelector({ selectedId, onSelect }: PresetSelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
      {CULTURAL_PRESETS.map((preset) => {
        const isSelected = preset.id === selectedId;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset.id)}
            className={clsx(
              'flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all',
              isSelected
                ? 'border-transparent bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
            )}
            style={isSelected ? { boxShadow: `0 8px 20px -6px ${preset.accentColor}66` } : undefined}
          >
            <span className="text-base">{preset.flagEmoji}</span>
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
