import type { CulturalPreset } from '@/types';

const presetPromptTemplate = (label: string) =>
  `Reescribe la idea central del siguiente mensaje adaptando el significado a la jerga, modismos y ritmo del habla de "${label}". ` +
  `Conserva el tono, la emocion y la intencionalidad original. No traduzcas literalmente palabra por palabra: adapta culturalmente. ` +
  `Responde unicamente con el texto reescrito, sin explicaciones ni comillas.`;

export const CULTURAL_PRESETS: CulturalPreset[] = [
  {
    id: 'norteno-mx',
    label: 'Mexicano del Norte (Norteño)',
    flagEmoji: '🤠',
    languageCode: 'es-MX',
    systemPrompt: presetPromptTemplate('Mexicano del Norte (Norteño)'),
    voiceId: 'voice_norteno_mx',
    pitchShift: -2,
    speedMultiplier: 1.05,
    accentColor: '#f59e0b',
  },
  {
    id: 'spanglish-fronterizo',
    label: 'Spanglish Fronterizo',
    flagEmoji: '🌵',
    languageCode: 'es-US',
    systemPrompt: presetPromptTemplate('Spanglish Fronterizo (mezcla espanol-ingles de la frontera)'),
    voiceId: 'voice_spanglish',
    pitchShift: 0,
    speedMultiplier: 1.1,
    accentColor: '#22d3ee',
  },
  {
    id: 'porteno-ba',
    label: 'Porteño de Buenos Aires',
    flagEmoji: '🧉',
    languageCode: 'es-AR',
    systemPrompt: presetPromptTemplate('Porteño de Buenos Aires'),
    voiceId: 'voice_porteno',
    pitchShift: 1,
    speedMultiplier: 0.98,
    accentColor: '#38bdf8',
  },
  {
    id: 'chilango',
    label: 'Chilango (CDMX)',
    flagEmoji: '🌮',
    languageCode: 'es-MX',
    systemPrompt: presetPromptTemplate('Chilango de la Ciudad de Mexico'),
    voiceId: 'voice_chilango',
    pitchShift: 0,
    speedMultiplier: 1.08,
    accentColor: '#a3e635',
  },
  {
    id: 'bronx-english',
    label: 'Inglés del Bronx',
    flagEmoji: '🗽',
    languageCode: 'en-US',
    systemPrompt: presetPromptTemplate('English from the Bronx, New York'),
    voiceId: 'voice_bronx',
    pitchShift: -1,
    speedMultiplier: 1.02,
    accentColor: '#f472b6',
  },
  {
    id: 'caribeno',
    label: 'Caribeño (PR/RD)',
    flagEmoji: '🏝️',
    languageCode: 'es-PR',
    systemPrompt: presetPromptTemplate('Caribeño de Puerto Rico / Republica Dominicana'),
    voiceId: 'voice_caribeno',
    pitchShift: 2,
    speedMultiplier: 1.15,
    accentColor: '#34d399',
  },
];

export const DEFAULT_PRESET_ID = CULTURAL_PRESETS[0].id;

export function getPresetById(id: string): CulturalPreset {
  return CULTURAL_PRESETS.find((p) => p.id === id) ?? CULTURAL_PRESETS[0];
}
