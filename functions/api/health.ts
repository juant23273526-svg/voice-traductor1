// Cloudflare Pages Function: GET /api/health
// Endpoint de diagnostico minimo, sin dependencias de ninguna API externa
// (Deepgram/Gemini/ElevenLabs) ni de bindings (Durable Objects). Si esta ruta
// tambien devuelve 500, el problema es de la infraestructura de Pages
// Functions (build del bundle, binding roto, compatibility_date/flags) y NO
// del codigo de negocio de /api/translate — aisla el diagnostico de raiz.
import { jsonResponse } from '../_shared/cors';

interface Env {
  DEEPGRAM_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  ELEVENLABS_API_KEY?: string;
  CARTESIA_API_KEY?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  return jsonResponse({
    status: 'ok',
    // Solo los NOMBRES de las variables presentes en context.env, nunca sus
    // valores: confirma si Cloudflare Pages esta inyectando los secrets
    // configurados sin exponer ninguna key.
    envKeys: Object.keys(context.env),
  });
};
