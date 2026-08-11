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
/** Deriva una extension de archivo a partir del MIME type real del blob (iOS graba en audio/mp4, no webm). */
function extensionForMimeType(mimeType: string): string {
  const [base] = mimeType.split(';');
  const map: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
  };
  return map[base] ?? 'webm';
}

export async function callTranslateApi(params: TranslateApiParams): Promise<TranslateApiResult> {
  const form = new FormData();
  const filename = `audio.${extensionForMimeType(params.audioBlob.type)}`;
  console.log('[translateApi] Enviando audio:', params.audioBlob.type || '(sin type)', params.audioBlob.size, 'bytes como', filename);
  form.append('audio', params.audioBlob, filename);
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

  let response: Response;
  try {
    response = await fetch('/api/translate', { method: 'POST', body: form });
  } catch (err) {
    console.error('[translateApi] Fallo de red llamando a /api/translate', err);
    throw err instanceof Error ? err : new Error('Fallo de red llamando a /api/translate');
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message = (errorBody as { error?: string } | null)?.error ?? `/api/translate fallo: ${response.status}`;
    console.error('[translateApi] Respuesta no ok:', response.status, message);
    throw new Error(message);
  }

  const result = (await response.json()) as TranslateApiResult;
  console.log('[translateApi] Respuesta OK. transcript:', result.transcript?.slice(0, 60));
  return result;
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  if (!base64) return new Blob([], { type: mimeType });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}
