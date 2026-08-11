// Cloudflare Pages Function: POST /api/translate
// Orquesta el Core Audio Pipeline completo del lado del edge (STT -> LLM -> TTS),
// manteniendo las API keys fuera del cliente. Usado por Modulo 1 (Slang), Modulo 2
// (Live Room) y Modulo 3 (Clip Studio) — todos comparten el mismo contrato.
//
// Request: multipart/form-data
//   - audio: Blob/File (clip de voz)
//   - meta: JSON string { sourceLanguage, targetLanguage, systemPrompt?, voiceId,
//                          stability?, speedMultiplier? }
//
// Response: JSON
//   { transcript, detectedLanguage, translatedText, audioBase64, mimeType, durationEstimateMs }
import { jsonResponse, preflightResponse } from '../_shared/cors';

interface Env {
  DEEPGRAM_API_KEY?: string;
  GEMINI_API_KEY?: string;
  /** Override opcional del modelo Gemini (por si el default queda deprecado). */
  GEMINI_MODEL?: string;
  ELEVENLABS_API_KEY?: string;
  CARTESIA_API_KEY?: string;
}

// Modelo oficial solicitado como primario. Si Google lo retira/renombra y
// empieza a responder 404 ("model not found"), se reintenta automaticamente
// con el siguiente de la lista en vez de romper la traduccion en produccion.
const GEMINI_MODEL_FALLBACKS = ['gemini-1.5-flash', 'gemini-2.0-flash'];

// Tamaño minimo de audio (bytes) para intentar STT. Clips mas cortos (tap
// accidental, silencio) no traen voz aprovechable y solo desperdician la
// llamada a Deepgram devolviendo un error confuso.
const MIN_AUDIO_BYTES = 2000;

interface PipelineMeta {
  sourceLanguage: string;
  targetLanguage: string;
  systemPrompt?: string;
  voiceId: string;
  stability?: number;
  speedMultiplier?: number;
}

export const onRequestOptions: PagesFunction = async () => preflightResponse();

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const form = await request.formData();
    // El tipado de @cloudflare/workers-types simplifica FormData.get() a
    // `string | null`, pero en runtime los campos de archivo llegan como File.
    const audio = form.get('audio') as unknown as File | string | null;
    const metaRaw = form.get('meta');

    if (typeof audio === 'string' || audio === null || typeof metaRaw !== 'string') {
      return jsonResponse({ error: 'Se requieren los campos "audio" y "meta"' }, 400);
    }

    const meta = JSON.parse(metaRaw) as PipelineMeta;
    const audioBuffer = await audio.arrayBuffer();

    if (audioBuffer.byteLength < MIN_AUDIO_BYTES) {
      console.error('[translate] Audio demasiado pequeño, se descarta sin llamar a Deepgram:', audioBuffer.byteLength, 'bytes');
      return jsonResponse(
        { error: 'Audio muy corto o vacío. Manten presionado el microfono mientras hablas.' },
        422
      );
    }

    const { transcript, detectedLanguage } = await runSpeechToText(audioBuffer, audio.type, meta.sourceLanguage, env);
    if (!transcript) {
      return jsonResponse({ error: 'No se detecto voz en el audio' }, 422);
    }

    const translatedText = await runTranslation(transcript, detectedLanguage || meta.sourceLanguage, meta, env);
    const { audioBase64, mimeType, durationEstimateMs } = await runTextToSpeech(translatedText, meta, env);

    return jsonResponse({
      transcript,
      detectedLanguage: detectedLanguage || meta.sourceLanguage,
      translatedText,
      audioBase64,
      mimeType,
      durationEstimateMs,
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
};

async function runSpeechToText(
  audioBuffer: ArrayBuffer,
  contentType: string,
  sourceLanguage: string,
  env: Env
): Promise<{ transcript: string; detectedLanguage: string }> {
  if (!env.DEEPGRAM_API_KEY) {
    return { transcript: '(demo) transcripcion simulada — configura DEEPGRAM_API_KEY', detectedLanguage: 'es' };
  }

  // Deepgram acepta `language=<code>` para forzar el modelo al idioma
  // esperado (mas preciso que `detect_language=true` en clips cortos, causa
  // frecuente de "voz no detectada"). Se usa el idioma que ya declaro el
  // caller (Slang/Live Room siempre mandan un codigo concreto); si viene
  // "auto"/vacio (Clip Studio) se usa español como default explicito.
  const language = sourceLanguage && sourceLanguage !== 'auto' ? sourceLanguage : 'es';

  // El Content-Type real del blob (audio/webm, audio/mp4, audio/aac en iOS
  // Safari, etc.) se pasa tal cual llega del cliente — nunca se asume webm.
  const resolvedContentType = contentType || 'audio/webm';
  console.log('[translate] STT Deepgram — language:', language, 'contentType:', resolvedContentType, 'bytes:', audioBuffer.byteLength);

  const params = new URLSearchParams({
    model: 'nova-2',
    language,
    smart_format: 'true',
    punctuate: 'true',
    word_timestamps: 'true',
  });

  const response = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
    method: 'POST',
    headers: { Authorization: `Token ${env.DEEPGRAM_API_KEY}`, 'Content-Type': resolvedContentType },
    body: audioBuffer,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error('[translate] Deepgram fallo:', response.status, errorBody.slice(0, 300));
    throw new Error(`Deepgram fallo: ${response.status}`);
  }

  const data = (await response.json()) as {
    results: { channels: Array<{ detected_language?: string; alternatives: Array<{ transcript: string }> }> };
  };

  const channel = data.results.channels[0];
  return {
    transcript: channel?.alternatives[0]?.transcript ?? '',
    detectedLanguage: channel?.detected_language || language,
  };
}

async function runTranslation(
  text: string,
  sourceLanguage: string,
  meta: PipelineMeta,
  env: Env
): Promise<string> {
  if (!env.GEMINI_API_KEY) {
    return `(demo) ${text}`;
  }

  const instructions =
    meta.systemPrompt ??
    `Traduce el siguiente texto de ${sourceLanguage} a ${meta.targetLanguage}. Conserva el tono y la emocion. Responde unicamente con la traduccion, sin explicaciones.`;

  // Si hay un override explicito (env.GEMINI_MODEL) se intenta primero; luego
  // se recorre la lista de fallback. Duplicados se descartan.
  const models = Array.from(new Set([env.GEMINI_MODEL, ...GEMINI_MODEL_FALLBACKS].filter(Boolean))) as string[];

  let lastError: Error | null = null;
  for (const model of models) {
    try {
      return await callGeminiGenerateContent(model, instructions, text, env.GEMINI_API_KEY);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[translate] Gemini modelo "${model}" fallo, probando siguiente si hay:`, lastError.message);
    }
  }

  // Fallback estatico/local: si TODOS los modelos de Gemini fallan (404, rate
  // limit, region bloqueada, etc.) no se rompe el pipeline completo con un
  // 500 — se degrada devolviendo el texto original sin traducir, para que el
  // cliente reciba una respuesta 200 parseable (transcripcion + audio TTS
  // siguen funcionando) en vez de un error duro.
  console.error('[translate] Gemini fallo con todos los modelos configurados, usando fallback local:', lastError?.message);
  return text;
}

async function callGeminiGenerateContent(
  model: string,
  systemInstruction: string,
  text: string,
  apiKey: string
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        // Los presets de jerga/dialecto (Spanglish Fronterizo, Norteño, etc.)
        // usan lenguaje coloquial que los umbrales default de Gemini a veces
        // bloquean por error; se relajan a BLOCK_ONLY_HIGH para evitar
        // respuestas vacias (candidates sin content.parts).
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
        generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Gemini (${model}) fallo: ${response.status} ${errorBody.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
  };

  const candidate = data.candidates?.[0];
  const translated = candidate?.content?.parts?.[0]?.text?.trim();

  if (!translated) {
    const reason = data.promptFeedback?.blockReason ?? candidate?.finishReason ?? 'desconocida';
    throw new Error(`Gemini (${model}) no devolvio texto valido (razon: ${reason})`);
  }

  return translated;
}

async function runTextToSpeech(
  text: string,
  meta: PipelineMeta,
  env: Env
): Promise<{ audioBase64: string; mimeType: string; durationEstimateMs: number }> {
  const durationEstimateMs = Math.max(600, text.length * 60);

  if (!env.ELEVENLABS_API_KEY) {
    return { audioBase64: '', mimeType: 'audio/mpeg', durationEstimateMs };
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${meta.voiceId}/stream`, {
    method: 'POST',
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_flash_v2_5',
      voice_settings: {
        stability: meta.stability ?? 0.4,
        similarity_boost: 0.85,
        style: 0.6,
        use_speaker_boost: true,
        speed: meta.speedMultiplier ?? 1,
      },
    }),
  });

  if (!response.ok) throw new Error(`ElevenLabs fallo: ${response.status}`);

  const buffer = await response.arrayBuffer();
  return { audioBase64: encodeBase64(buffer), mimeType: 'audio/mpeg', durationEstimateMs };
}

function encodeBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

