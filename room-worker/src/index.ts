// Worker independiente que hospeda el Durable Object de las Live Rooms.
// Cloudflare Pages NO permite definir ni desplegar un Durable Object dentro
// de un proyecto Pages (ni en functions/, ni en un _worker.js/_worker.ts):
// la clase debe vivir en un Worker separado, desplegado con
// `wrangler deploy --config room-worker/wrangler.toml`, y el proyecto Pages
// se conecta a el via un binding con `script_name` (ver ../wrangler.toml).
export interface Env {
  ROOMS: DurableObjectNamespace;
}

interface Session {
  role: 'host' | 'guest';
}

/**
 * Estado en memoria de una Live Room: mantiene las conexiones WebSocket de
 * host e invitado y reenvia (relay) los mensajes traducidos entre ambos.
 * Cuando ambas conexiones se cierran, la instancia queda vacia y Cloudflare
 * la recicla — cero persistencia, cero registros.
 */
export class RoomDurableObject implements DurableObject {
  private sessions = new Map<WebSocket, Session>();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const role: Session['role'] = url.searchParams.get('role') === 'host' ? 'host' : 'guest';

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    this.handleSession(server, role);

    return new Response(null, { status: 101, webSocket: client });
  }

  private handleSession(ws: WebSocket, role: Session['role']): void {
    ws.accept();
    this.sessions.set(ws, { role });
    this.broadcastPresence();

    ws.addEventListener('message', (event: MessageEvent) => {
      // El cliente siempre envia JSON como texto (ver websocketRoom.ts); si
      // llegara un frame binario (ArrayBuffer/Blob) se descarta explicitamente
      // en vez de intentar relayarlo tal cual, para no reenviar basura al otro
      // participante.
      if (typeof event.data !== 'string') {
        console.error('[RoomDO] Frame no textual recibido, se ignora:', typeof event.data);
        return;
      }
      this.relay(event.data, ws);
    });

    const cleanup = () => {
      this.sessions.delete(ws);
      this.broadcastPresence();
    };
    ws.addEventListener('close', cleanup);
    ws.addEventListener('error', cleanup);
  }

  /**
   * Reenvia el mensaje (texto + audio en base64) a todos menos al emisor.
   * Valida que el payload tenga la forma esperada (RoomSocketEvent con
   * `type: 'message'` y `message.audioBase64`/`mimeType`) antes de
   * retransmitirlo: un JSON malformado o con campos faltantes se descarta y
   * se loguea, en vez de reenviar una estructura invalida que el receptor no
   * pueda deserializar (causa raiz de "no reconoce audio" cuando el payload
   * no coincide con lo que el cliente espera).
   */
  private relay(data: string, sender: WebSocket): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch (err) {
      console.error('[RoomDO] JSON invalido recibido, se descarta sin relayar:', err);
      return;
    }

    if (!this.isValidRoomSocketEvent(parsed)) {
      console.error('[RoomDO] Payload con estructura invalida, se descarta sin relayar:', JSON.stringify(parsed).slice(0, 200));
      return;
    }

    for (const ws of this.sessions.keys()) {
      if (ws === sender) continue;
      this.safeSend(ws, data);
    }
  }

  /** Valida minimamente la forma de un RoomSocketEvent antes de retransmitirlo. */
  private isValidRoomSocketEvent(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) return false;
    const event = value as { type?: unknown; message?: unknown };

    if (event.type === 'presence') return true;

    if (event.type === 'message') {
      if (typeof event.message !== 'object' || event.message === null) return false;
      const message = event.message as Record<string, unknown>;
      return (
        typeof message.id === 'string' &&
        typeof message.senderRole === 'string' &&
        typeof message.originalText === 'string' &&
        typeof message.translatedText === 'string' &&
        (message.audioBase64 === null || typeof message.audioBase64 === 'string') &&
        (message.mimeType === null || typeof message.mimeType === 'string')
      );
    }

    return false;
  }

  private broadcastPresence(): void {
    const roles = Array.from(this.sessions.values()).map((s) => s.role);
    const payload = JSON.stringify({ type: 'presence', roles });
    for (const ws of this.sessions.keys()) {
      this.safeSend(ws, payload);
    }
  }

  private safeSend(ws: WebSocket, data: string): void {
    try {
      ws.send(data);
    } catch {
      this.sessions.delete(ws);
    }
  }
}

// Entry point requerido por Wrangler para desplegar este Worker de forma
// independiente. No se usa directamente: Cloudflare Pages invoca
// RoomDurableObject solo a traves del binding `ROOMS` (script_name), nunca
// mediante una URL publica de este Worker.
export default {
  async fetch(): Promise<Response> {
    return new Response('voxlingo-room-worker: acceder via el binding ROOMS desde Cloudflare Pages', {
      status: 404,
    });
  },
};
