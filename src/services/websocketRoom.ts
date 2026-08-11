import type { RoomMessage, RoomParticipantRole, RoomSocketEvent } from '@/types';

export interface RoomSocketHandle {
  send: (message: RoomMessage) => void;
  close: () => void;
}

function buildRoomWsUrl(roomId: string, role: RoomParticipantRole): string {
  // En https:// (obligatorio para PWA/microfono en iOS Safari) el WebSocket
  // debe usar wss:// — un ws:// desde una pagina https es bloqueado por el
  // navegador (mixed content).
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/room/${roomId}?role=${role}`;
}

/**
 * Cliente WebSocket para una Live Room. Se conecta al Durable Object en
 * `/api/room/:id` (Cloudflare Pages Function) que relaya mensajes en memoria
 * entre host e invitado — sin base de datos ni almacenamiento persistente.
 */
export function connectToRoom(
  roomId: string,
  role: RoomParticipantRole,
  onEvent: (event: RoomSocketEvent) => void,
  onStatusChange: (status: 'connecting' | 'open' | 'closed' | 'error') => void
): RoomSocketHandle {
  const wsUrl = buildRoomWsUrl(roomId, role);
  console.log('[RoomSocket] Conectando a', wsUrl);
  const socket = new WebSocket(wsUrl);
  onStatusChange('connecting');

  socket.onopen = () => {
    console.log('[RoomSocket] Conexion abierta');
    onStatusChange('open');
  };
  socket.onclose = (event) => {
    console.log('[RoomSocket] Conexion cerrada', event.code, event.reason);
    onStatusChange('closed');
  };
  socket.onerror = (event) => {
    console.error('[RoomSocket] Error de WebSocket', event);
    onStatusChange('error');
  };

  socket.onmessage = (event: MessageEvent) => {
    if (typeof event.data !== 'string') return;
    try {
      const parsed = JSON.parse(event.data) as RoomSocketEvent;
      onEvent(parsed);
    } catch (err) {
      console.error('[RoomSocket] Mensaje invalido recibido, se ignora', err);
    }
  };

  return {
    send: (message: RoomMessage) => {
      if (socket.readyState !== WebSocket.OPEN) {
        console.warn('[RoomSocket] Intento de enviar con socket no abierto (readyState=', socket.readyState, ')');
        return;
      }
      const event: RoomSocketEvent = { type: 'message', message };
      socket.send(JSON.stringify(event));
    },
    close: () => socket.close(),
  };
}

export function generateRoomId(): string {
  return crypto.randomUUID();
}

export function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
