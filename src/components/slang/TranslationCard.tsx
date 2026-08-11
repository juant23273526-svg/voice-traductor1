import { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';
import type { TranscriptionResult, TranslationResult } from '@/types';
import { getPresetById } from '@/constants/culturalPresets';

interface TranslationCardProps {
  transcription: TranscriptionResult;
  translation: TranslationResult;
  audioUrl: string | null;
}

/**
 * Tarjeta estilo TikTok: texto original vs version adaptada,
 * con subtitulos resaltados palabra por palabra mientras se reproduce el audio.
 */
export function TranslationCard({ transcription, translation, audioUrl }: TranslationCardProps) {
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const translatedWords = translation.translatedText.split(/\s+/).filter(Boolean);
  const preset = translation.presetId ? getPresetById(translation.presetId) : null;

  useEffect(() => {
    setActiveWordIndex(-1);
    if (!audioUrl) return;

    const wordDurationMs = 260;
    const timers = translatedWords.map((_, i) =>
      setTimeout(() => setActiveWordIndex(i), i * wordDurationMs)
    );

    return () => timers.forEach(clearTimeout);
  }, [audioUrl, translation.translatedText]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 shadow-2xl">
      <div
        className="flex items-center justify-between px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-950"
        style={{ background: preset?.accentColor ?? '#6366f1' }}
      >
        <span>{preset ? `${preset.flagEmoji} ${preset.label}` : 'Traduccion'}</span>
        {audioUrl && <Volume2 size={16} />}
      </div>

      <div className="space-y-4 p-5">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Original
          </p>
          <p className="text-sm text-slate-400">{transcription.transcript}</p>
        </div>

        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Adaptado
          </p>
          <p className="text-xl font-semibold leading-snug text-slate-50">
            {translatedWords.map((word, i) => (
              <span
                key={`${word}-${i}`}
                className={
                  i === activeWordIndex
                    ? 'animate-word-pop rounded bg-emerald-400/90 px-1 text-slate-950'
                    : i < activeWordIndex
                      ? 'text-emerald-300'
                      : 'text-slate-50'
                }
              >
                {word}{' '}
              </span>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}
