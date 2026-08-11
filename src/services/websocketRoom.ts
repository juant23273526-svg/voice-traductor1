import type { RoomMessage, RoomParticipantRole, RoomSocketEvent } from '@/types';

export interface RoomSocketHandle {
  send: (message: RoomMessage) => void;
  close: () => void;
}

function buildRoomWsUrl(roomId: string, role: RoomParticipantRole): string {
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
  const socket = new WebSocket(buildRoomWsUrl(roomId, role));
  onStatusChange('connecting');

  socket.onopen = () => onStatusChange('open');
  socket.onclose = () => onStatusChange('closed');
  socket.onerror = () => onStatusChange('error');

  socket.onmessage = (event: MessageEvent) => {
    if (typeof event.data !== 'string') return;
    try {
      const parsed = JSON.parse(event.data) as RoomSocketEvent;
      onEvent(parsed);
    } catch {
      // mensaje no valido, se ignora
    }
  };

  return {
    send: (message: RoomMessage) => {
      if (socket.readyState !== WebSocket.OPEN) return;
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
