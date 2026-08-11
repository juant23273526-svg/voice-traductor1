import type { WordTimestamp } from '@/types';

/** Distribuye palabras uniformemente sobre la duracion de audio (aprox. para preview/export). */
export function buildWordCues(text: string, durationMs: number): WordTimestamp[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const perWordSeconds = durationMs / 1000 / words.length;
  return words.map((word, i) => ({
    word,
    start: i * perWordSeconds,
    end: (i + 1) * perWordSeconds,
    confidence: 1,
  }));
}

function formatSrtTime(seconds: number): string {
  const ms = Math.round((seconds % 1) * 1000);
  const totalSeconds = Math.floor(seconds);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/** Agrupa palabras en bloques cortos (estilo CapCut) y genera un archivo .srt. */
export function buildSrtFromWords(words: WordTimestamp[], wordsPerCue = 4): string {
  const cues: string[] = [];
  let cueIndex = 1;

  for (let i = 0; i < words.length; i += wordsPerCue) {
    const group = words.slice(i, i + wordsPerCue);
    const start = group[0].start;
    const end = group[group.length - 1].end;
    const text = group.map((w) => w.word).join(' ');

    cues.push(`${cueIndex}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${text}\n`);
    cueIndex += 1;
  }

  return cues.join('\n');
}
