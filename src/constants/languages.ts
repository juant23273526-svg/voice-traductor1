export interface LanguageOption {
  code: string;
  label: string;
  flagEmoji: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'es', label: 'Español', flagEmoji: '🇲🇽' },
  { code: 'en', label: 'English', flagEmoji: '🇺🇸' },
  { code: 'pt', label: 'Português', flagEmoji: '🇧🇷' },
  { code: 'fr', label: 'Français', flagEmoji: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flagEmoji: '🇩🇪' },
  { code: 'it', label: 'Italiano', flagEmoji: '🇮🇹' },
];

export function getLanguageOption(code: string): LanguageOption {
  return LANGUAGE_OPTIONS.find((l) => l.code === code) ?? LANGUAGE_OPTIONS[0];
}
