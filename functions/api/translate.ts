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
  ELEVENLABS_API_KEY?: string;
  CARTESIA_API_KEY?: string;
}

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

    const { transcript, detectedLanguage } = await runSpeechToText(audioBuffer, audio.type, env);
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
  env: Env
): Promise<{ transcript: string; detectedLanguage: string }> {
  if (!env.DEEPGRAM_API_KEY) {
    return { transcript: '(demo) transcripcion simulada — configura DEEPGRAM_API_KEY', detectedLanguage: 'es' };
  }

  const response = await fetch(
    'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&detect_language=true&punctuate=true&word_timestamps=true',
    {
      method: 'POST',
      headers: { Authorization: `Token ${env.DEEPGRAM_API_KEY}`, 'Content-Type': contentType || 'audio/webm' },
      body: audioBuffer,
    }
  );

  if (!response.ok) throw new Error(`Deepgram fallo: ${response.status}`);
  const data = (await response.json()) as {
    results: { channels: Array<{ detected_language?: string; alternatives: Array<{ transcript: string }> }> };
  };

  const channel = data.results.channels[0];
  return {
    transcript: channel?.alternatives[0]?.transcript ?? '',
    detectedLanguage: channel?.detected_language ?? '',
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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instructions }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
      }),
    }
  );

  if (!response.ok) throw new Error(`Gemini fallo: ${response.status}`);
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const translated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!translated) throw new Error('Gemini no devolvio traduccion');
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

