# VoxLingo — PWA Traductora Viral Multimodal (Cloudflare Pages, Serverless)

Traduccion e interpretacion de voz en tiempo real con IA generativa. React + TypeScript + Vite + Tailwind CSS v4, PWA instalable, 100% desplegable en **Cloudflare Pages** — sin base de datos SQL. El estado de las salas en vivo vive en memoria dentro de un **Durable Object** y se libera solo al cerrarse.

## Modulos

1. **Slang & Personality** (`/`) — voz a voz adaptada a jerga cultural (Norteño, Spanglish, Porteño, Chilango, Bronx, Caribeño), hold-to-talk con visualizador de ondas.
2. **Live Room / Walkie-Talkie** (`/live`, `/room/:roomId`) — sala efimera en tiempo real via WebSockets + Durable Object, con QR para el invitado (sin registro).
3. **Clip Studio & Doblaje Express** (`/clips`) — doblaje sintetico y subtitulos dinamicos sobre video corto, procesado con FFmpeg.wasm en el navegador.

## Arquitectura

```
src/                        # PWA (React + Vite + Tailwind v4)
  services/
    AudioPipelineService.ts   # captura de mic + orquesta /api/translate + reproduccion
    translateApi.ts           # cliente HTTP hacia /api/translate
    websocketRoom.ts          # cliente WS hacia /api/room/:id
    FFmpegService.ts          # FFmpeg.wasm (extraccion de audio, export de clip)
functions/                  # Cloudflare Pages Functions (edge, TypeScript)
  api/translate.ts            # STT (Deepgram) -> LLM (Gemini) -> TTS (ElevenLabs/Cartesia)
  api/room/[id].ts            # upgrade a WebSocket, reenvia al binding ROOMS
room-worker/                # Worker independiente (fuera del proyecto Pages)
  src/index.ts                 # define y exporta RoomDurableObject
  wrangler.toml                # su propio name/migrations, deploy separado
wrangler.toml                # config de Pages; binding ROOMS -> script_name = room-worker
```

No hay Postgres/MySQL ni Supabase: las 3 API keys de IA viven solo como *secrets* de
Cloudflare Pages y se consumen exclusivamente dentro de `functions/api/translate.ts`;
el cliente nunca las ve.

**Sobre el Durable Object:** Cloudflare Pages no permite definir ni desplegar una
clase de Durable Object dentro de un proyecto Pages (ni en `functions/`, ni con un
`_worker.js`/`_worker.ts` — eso ademas desactivaria por completo el ruteo de
`functions/`). Por eso `RoomDurableObject` vive en `room-worker/`, un Worker
independiente que se despliega aparte; el proyecto Pages solo se conecta a el via
el binding `ROOMS` con `script_name` en `wrangler.toml`. Las Live Rooms no se
persisten en ningun lado — el Durable Object mantiene las conexiones WebSocket
activas en memoria y las descarta cuando ambos participantes se desconectan.

## Setup

```bash
npm install
npm run dev              # UI en http://localhost:5173 (sin /api/*, usa datos mock)
```

Para probar el pipeline completo (`/api/translate`, `/api/room/:id`) localmente:

```bash
cp .env.example .dev.vars   # completa las API keys (ver comentarios en .env.example)
npm run pages:dev           # build + wrangler pages dev dist
```

### Deploy

Primero el Worker que hospeda el Durable Object (una sola vez, o cuando cambie su codigo):

```bash
npx wrangler deploy --config room-worker/wrangler.toml
```

Despues el proyecto Pages:

```bash
wrangler pages project create voxlingo
wrangler pages secret put DEEPGRAM_API_KEY
wrangler pages secret put GEMINI_API_KEY
wrangler pages secret put ELEVENLABS_API_KEY
wrangler pages secret put CARTESIA_API_KEY   # opcional
npm run deploy
```

El binding `ROOMS` en `wrangler.toml` (con `script_name = "voxlingo-room-worker"`)
conecta Pages con la clase `RoomDurableObject` publicada por `room-worker/`. Si
renombras el Worker, actualiza `script_name` para que coincida.

## Stack

- Frontend: React 18 + TypeScript + Vite + Tailwind CSS v4 (`@tailwindcss/vite`)
- PWA: `vite-plugin-pwa`
- Edge: Cloudflare Pages Functions + Durable Objects (WebSockets en memoria)
- STT: Deepgram Nova-2 (word-level timestamps, deteccion de idioma)
- LLM: Gemini 1.5 Flash
- TTS: ElevenLabs Flash v2.5 / Cartesia Sonic (voice cloning, sin voces robóticas)
- Video: FFmpeg.wasm (`@ffmpeg/ffmpeg`, `@ffmpeg/util`) — 100% en el cliente

## Sin API keys

Si `/api/translate` no encuentra las API keys configuradas, responde con datos
mock (transcripcion/traduccion de demo, sin audio) para poder probar toda la UI
y el flujo de estados sin credenciales reales.
