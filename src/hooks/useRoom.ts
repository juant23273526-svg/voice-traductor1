import { useCallback, useEffect, useRef, useState } from 'react';
import { connectToRoom, type RoomSocketHandle } from '@/services/websocketRoom';
import type { RoomMessage, RoomParticipantRole } from '@/types';

type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'error';

export function useRoom(roomId: string | undefined, role: RoomParticipantRole) {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [onlineRoles, setOnlineRoles] = useState<RoomParticipantRole[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const handleRef = useRef<RoomSocketHandle | null>(null);

  useEffect(() => {
    if (!roomId) return;

    const handle = connectToRoom(
      roomId,
      role,
      (event) => {
        if (event.type === 'presence') {
          setOnlineRoles(event.roles);
        } else if (event.type === 'message') {
          setMessages((prev) => [...prev, event.message]);
        }
      },
      setConnectionStatus
    );
    handleRef.current = handle;

    return () => {
      handle.close();
      handleRef.current = null;
    };
  }, [roomId, role]);

  const sendMessage = useCallback((message: RoomMessage) => {
    setMessages((prev) => [...prev, message]);
    handleRef.current?.send(message);
  }, []);

  const guestJoined = onlineRoles.includes('guest');
  const hostOnline = onlineRoles.includes('host');
  const loading = connectionStatus === 'connecting';
  const error = connectionStatus === 'error' ? new Error('No se pudo conectar a la sala') : null;

  return { messages, sendMessage, connectionStatus, loading, error, guestJoined, hostOnline };
}

export type { ConnectionStatus };
