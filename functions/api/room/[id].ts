// Cloudflare Pages Function: GET /api/room/:id (WebSocket upgrade)
// Enruta la conexion hacia el Durable Object de la sala. La clase
// RoomDurableObject NO vive aqui: Cloudflare Pages no permite definir ni
// desplegar Durable Objects dentro de un proyecto Pages (ni en functions/,
// ni en un _worker.js/_worker.ts). Vive en el Worker independiente
// room-worker/ y este proyecto se conecta a el via el binding `ROOMS`
// (con `script_name`, ver wrangler.toml).
export interface Env {
  ROOMS: DurableObjectNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const roomId = params.id as string;

  if (!roomId) {
    return new Response('room id requerido', { status: 400 });
  }

  if (request.headers.get('Upgrade') !== 'websocket') {
    return new Response('Se espera una conexion WebSocket (header Upgrade)', { status: 426 });
  }

  const durableObjectId = env.ROOMS.idFromName(roomId);
  const stub = env.ROOMS.get(durableObjectId);
  return stub.fetch(request);
};
