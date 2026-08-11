export interface TranslateApiResult {
  transcript: string;
  detectedLanguage: string;
  translatedText: string;
  audioBase64: string;
  mimeType: string;
  durationEstimateMs: number;
}

export interface TranslateApiParams {
  audioBlob: Blob;
  sourceLanguage: string;
  targetLanguage: string;
  systemPrompt?: string;
  voiceId: string;
  stability?: number;
  speedMultiplier?: number;
}

/**
 * Cliente para la Cloudflare Pages Function `/api/translate`, que ejecuta
 * STT (Deepgram) -> LLM (Gemini) -> TTS (ElevenLabs/Cartesia) en el edge.
 * Ninguna API key vive en el bundle del cliente.
 */
export async function callTranslateApi(params: TranslateApiParams): Promise<TranslateApiResult> {
  const form = new FormData();
  form.append('audio', params.audioBlob, 'audio.webm');
  form.append(
    'meta',
    JSON.stringify({
      sourceLanguage: params.sourceLanguage,
      targetLanguage: params.targetLanguage,
      systemPrompt: params.systemPrompt,
      voiceId: params.voiceId,
      stability: params.stability,
      speedMultiplier: params.speedMultiplier,
    })
  );

  const response = await fetch('/api/translate', { method: 'POST', body: form });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(
      (errorBody as { error?: string } | null)?.error ?? `/api/translate fallo: ${response.status}`
    );
  }

  return response.json() as Promise<TranslateApiResult>;
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  if (!base64) return new Blob([], { type: mimeType });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}
