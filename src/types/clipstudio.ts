export type SubtitlePosition = 'top' | 'middle' | 'bottom';

export interface SubtitleStyle {
  /** Color de resalte de la palabra activa (hex). */
  highlightColor: string;
  /** CSS font-family usada para renderizar el subtitulo. */
  fontFamily: string;
  position: SubtitlePosition;
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  highlightColor: '#10b981',
  fontFamily: 'system-ui, sans-serif',
  position: 'bottom',
};

export interface SubtitleColorOption {
  label: string;
  value: string;
}

export const SUBTITLE_COLOR_OPTIONS: SubtitleColorOption[] = [
  { label: 'Verde', value: '#10b981' },
  { label: 'Amarillo', value: '#facc15' },
  { label: 'Fucsia', value: '#ec4899' },
  { label: 'Cian', value: '#22d3ee' },
  { label: 'Blanco', value: '#f8fafc' },
];

export interface SubtitleFontOption {
  label: string;
  value: string;
}

export const SUBTITLE_FONT_OPTIONS: SubtitleFontOption[] = [
  { label: 'Sistema', value: 'system-ui, sans-serif' },
  { label: 'Impact', value: '"Arial Black", Impact, sans-serif' },
  { label: 'Monoespaciada', value: '"Courier New", monospace' },
  { label: 'Serif', value: 'Georgia, serif' },
];

export const SUBTITLE_POSITION_OPTIONS: { label: string; value: SubtitlePosition }[] = [
  { label: 'Abajo', value: 'bottom' },
  { label: 'Centro', value: 'middle' },
  { label: 'Arriba', value: 'top' },
];
